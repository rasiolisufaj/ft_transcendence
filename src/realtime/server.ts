import type { AddressInfo } from "node:net";
import { WebSocketServer, type WebSocket } from "ws";
import { log } from "./log";

type Options = {
  port: number;
  heartbeatMs: number; // ms to check if a client is alive
};

export function startServer({ port, heartbeatMs }: Options) {
  const server = new WebSocketServer({ port });

  server.on("listening", () => {
    log("info", "realtime server listening", { port: (server.address() as AddressInfo).port });
  });

  server.on("error", (error) => {
    log("error", "realtime server error", { error: error.message });
  });

  const alive = new Set<WebSocket>();

  server.on("connection", (socket) => {
    alive.add(socket);
    log("info", "client connected", { clients: server.clients.size });
    socket.send(JSON.stringify({ type: "hello" }));

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
