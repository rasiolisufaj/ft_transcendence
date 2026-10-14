import type { IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import { WebSocketServer, type WebSocket } from "ws";
import { verifyTicket } from "@/lib/auth/ticket";
import { readTicket } from "./handshake";
import { log } from "./log";

type Options = {
  port: number;
  heartbeatMs: number; // ms to check if a client is alive
};

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

  server.on("connection", (socket, request) => {
    const userId = users.get(request);
    alive.add(socket);
    log("info", "client connected", { userId, clients: server.clients.size });
    socket.send(JSON.stringify({ type: "hello", userId }));

    socket.on("pong", () => {
      alive.add(socket);
    });

    socket.on("close", () => {
      alive.delete(socket);
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
