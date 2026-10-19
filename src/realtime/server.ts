import type { IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import { WebSocketServer, type WebSocket } from "ws";
import { parseClientMessage, type ServerMessage } from "@/contracts/socket";
import { verifyTicket } from "@/lib/auth/ticket";
import { canSubscribe, readTicket } from "./handshake";
import { log } from "./log";
import { isChannelMember } from "./membership";

type Options = {
  port: number;
  heartbeatMs: number; // ms to check if a client is alive
};

function send(socket: WebSocket, message: ServerMessage) {
  socket.send(JSON.stringify(message));
}

export function startServer({ port, heartbeatMs }: Options) {
  // verifyClient can only say yes or no: the user id waits here until "connection".
  const users = new WeakMap<IncomingMessage, string>();

  const server = new WebSocketServer({
    port,
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

  server.on("listening", () => {
    log("info", "realtime server listening", { port: (server.address() as AddressInfo).port });
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
      if (!(await canSubscribe(userId, message.topic, isChannelMember))) {
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
        log("info", "realtime server stopped");
        resolve();
      });
    });
  }
  return { server, stop };
}
