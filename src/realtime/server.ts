import { timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import { WebSocketServer, type WebSocket } from "ws";
import { parseClientMessage, parsePublishBody, type ServerMessage } from "@/contracts/socket";
import { verifyTicket } from "@/lib/auth/ticket";
import { friendsOf as findFriends, type FriendsOf } from "./friends";
import { canSubscribe, readTicket, type IsMember } from "./handshake";
import { log } from "./log";
import { isChannelMember } from "./membership";

type Options = {
  port: number;
  heartbeatMs: number; // ms to check if a client is alive
  isMember?: IsMember;
  friendsOf?: FriendsOf;
  publishSecret: string;
};

function send(socket: WebSocket, message: ServerMessage) {
  socket.send(JSON.stringify(message));
}

function hasSecret(header: string | undefined, secret: string): boolean {
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header ?? "");
  // timingSafe more secure than === because attacker can find the secret char by char from the response time with ===
  return expected.length === given.length && timingSafeEqual(expected, given);
}

const MAX_BODY_BYTES = 64 * 1024;

async function readBody(request: IncomingMessage): Promise<string | null> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    size += (chunk as Buffer).length;
    if (size <= MAX_BODY_BYTES) {
      chunks.push(chunk as Buffer);
    }
  }
  if (size > MAX_BODY_BYTES) {
    return null;
  }
  return Buffer.concat(chunks).toString();
}

export function startServer({
  port,
  heartbeatMs,
  isMember = isChannelMember,
  friendsOf = findFriends,
  publishSecret,
}: Options) {
  // verifyClient can only say yes or no: the user id waits here until "connection".
  const users = new WeakMap<IncomingMessage, string>();

  const http = createServer();
  const server = new WebSocketServer({
    server: http,
    maxPayload: 4096,
    verifyClient: ({ req }: { req: IncomingMessage }) => {
      const ticket = readTicket(req.url);
      const result = ticket ? verifyTicket(ticket) : null;
      if (!result) {
        return false; // ws answers 401
      }
      users.set(req, result.userId);
      return true;
    },
  });

  http.on("listening", () => {
    log("info", "realtime server listening", { port: (http.address() as AddressInfo).port });
  });

  http.on("request", async (request, response) => {
    if (request.method !== "POST" || request.url !== "/publish") {
      response.writeHead(404).end();
      return;
    }
    if (!hasSecret(request.headers.authorization, publishSecret)) {
      response.writeHead(401).end();
      return;
    }
    let raw: string | null = "";
    try {
      raw = await readBody(request);
    } catch {
      raw = "";
    }
    if (raw === null) {
      response.writeHead(413).end();
      return;
    }
    const body = parsePublishBody(raw);
    if (!body) {
      response.writeHead(400).end();
      return;
    }
    for (const [socket, mine] of topics) {
      if (mine.has(body.topic)) {
        send(socket, { type: "event", topic: body.topic, event: body.event });
      }
    }
    const { type, channelId, userId } = body.event;
    if (type === "member.left" && typeof channelId === "number" && typeof userId === "string") {
      for (const [socket, owner] of owners) {
        if (owner === userId) {
          topics.get(socket)?.delete(`channel:${channelId}`);
        }
      }
    }
    response.writeHead(204).end();
  });

  server.on("error", (error) => {
    log("error", "realtime server error", { error: error.message });
  });

  const alive = new Set<WebSocket>();
  const topics = new Map<WebSocket, Set<string>>();
  const owners = new Map<WebSocket, string>();
  const connections = new Map<string, number>();

  async function lookup(userId: string): Promise<string[]> {
    try {
      return await friendsOf(userId);
    } catch (error) {
      log("error", "friends lookup failed", { userId, error: String(error) });
      return [];
    }
  }

  // Sends the user's state at send time, so a fast connect + disconnect still ends on the right one.
  async function announce(userId: string) {
    const friends = await lookup(userId);
    const online = connections.has(userId);
    for (const [socket, mine] of topics) {
      for (const friend of friends) {
        if (mine.has(`user:${friend}`)) {
          send(socket, { type: "presence", userId, online });
        }
      }
    }
  }

  async function welcome(socket: WebSocket, userId: string) {
    for (const friend of await lookup(userId)) {
      if (connections.has(friend)) {
        send(socket, { type: "presence", userId: friend, online: true });
      }
    }
  }

  server.on("connection", (socket, request) => {
    const userId = users.get(request);
    if (!userId) {
      socket.terminate();
      return;
    }
    alive.add(socket);
    topics.set(socket, new Set([`user:${userId}`]));
    owners.set(socket, userId);
    const count = (connections.get(userId) ?? 0) + 1;
    connections.set(userId, count);
    if (count === 1) {
      void announce(userId);
    }
    log("info", "client connected", { userId, clients: server.clients.size });
    send(socket, { type: "hello", userId });
    void welcome(socket, userId);

    socket.on("message", async (data) => {
      const message = parseClientMessage(data.toString());
      if (!message) {
        send(socket, { type: "error", code: "badRequest" });
        return;
      }

      const mine = topics.get(socket);
      if (!mine) {
        return;
      }
      if (message.type === "unsubscribe") {
        mine.delete(message.topic);
        send(socket, { type: "unsubscribed", topic: message.topic });
        return;
      }
      let allowed = false;
      try {
        allowed = await canSubscribe(userId, message.topic, isMember);
      } catch (error) {
        log("error", "membership check failed", { userId, topic: message.topic, error: String(error) });
      }
      if (!allowed) {
        send(socket, { type: "error", code: "forbidden", topic: message.topic });
        return;
      }
      mine.add(message.topic);
      send(socket, { type: "subscribed", topic: message.topic });
    });

    socket.on("error", (error) => {
      log("warn", "client error", { userId, error: error.message });
    });

    socket.on("pong", () => {
      alive.add(socket);
    });

    socket.on("close", () => {
      alive.delete(socket);
      topics.delete(socket);
      owners.delete(socket);
      const left = (connections.get(userId) ?? 1) - 1;
      if (left === 0) {
        connections.delete(userId);
        void announce(userId);
      } else {
        connections.set(userId, left);
      }
      log("info", "client disconnected", { clients: server.clients.size });
    });
  });

  const heartbeat = setInterval(() => {
    for (const socket of server.clients) {
      if (!alive.has(socket)) {
        log("warn", "client timed out");
        socket.terminate();
        continue;
      }
      alive.delete(socket);
      socket.ping();
    }
  }, heartbeatMs);

  function stop(): Promise<void> {
    clearInterval(heartbeat);

    for (const socket of server.clients) {
      socket.close(1001, "server shutting down");
    }

    setTimeout(() => {
      for (const socket of server.clients) {
        socket.terminate();
      }
    }, 5000).unref();

    return new Promise((resolve) => {
      server.close(() => {
        http.close(() => {
          log("info", "realtime server stopped");
          resolve();
        });
      });
    });
  }
  http.listen(port);
  return { server, http, stop };
}
