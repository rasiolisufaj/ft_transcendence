import { timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import { WebSocketServer, type WebSocket } from "ws";
import { parseClientMessage, parsePublishBody, type ServerMessage } from "@/contracts/socket";
import { verifyTicket } from "@/lib/auth/ticket";
import { canSubscribe, readTicket, type IsMember } from "./handshake";
import { log } from "./log";
import { isChannelMember } from "./membership";

type Options = {
  port: number;
  heartbeatMs: number; // ms to check if a client is alive
  isMember?: IsMember;
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

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString();
}

export function startServer({ port, heartbeatMs, isMember = isChannelMember, publishSecret }: Options) {
  // verifyClient can only say yes or no: the user id waits here until "connection".
  const users = new WeakMap<IncomingMessage, string>();

  const http = createServer();
  const server = new WebSocketServer({
    server: http,
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
    let body = null;
    try {
      body = parsePublishBody(await readBody(request));
    } catch {
      body = null;
    }
    if (!body) {
      response.writeHead(400).end();
      return;
    }
    for (const [socket, mine] of topics) {
      if (mine.has(body.topic)) {
        send(socket, { type: "event", topic: body.topic, event: body.event });
      }
    }
    response.writeHead(204).end();
  });

  server.on("error", (error) => {
    log("error", "realtime server error", { error: error.message });
  });

  const alive = new Set<WebSocket>();
  const topics = new Map<WebSocket, Set<string>>();

  server.on("connection", (socket, request) => {
    const userId = users.get(request);
    if (!userId) {
      socket.terminate();
      return;
    }
    alive.add(socket);
    topics.set(socket, new Set([`user:${userId}`]));
    log("info", "client connected", { userId, clients: server.clients.size });
    send(socket, { type: "hello", userId });

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

    socket.on("pong", () => {
      alive.add(socket);
    });

    socket.on("close", () => {
      alive.delete(socket);
      topics.delete(socket);
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
