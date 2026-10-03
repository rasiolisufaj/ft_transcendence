import { WebSocketServer, type WebSocket } from "ws";
import { log } from "./log";

// run with -> npm run realtime
const port = Number(process.env.REALTIME_PORT ?? 3001);
// ms to cheeck if a client is alive
const heartbeatMs = Number(process.env.HEARTBEAT_MS ?? 30000);

const server = new WebSocketServer({ port });

server.on("listening", () => {
  log("info", "realtime server listening", { port });
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

let shuttingDown = false;

function shutdown(signal: string) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  log("info", "shutting down", { signal, clients: server.clients.size });
  clearInterval(heartbeat);

  for (const socket of server.clients) {
    socket.close(1001, "server shutting down");
  }

  setTimeout(() => {
    for (const socket of server.clients) {
      socket.terminate();
    }
  }, 5000).unref();

  server.close(() => {
    log("info", "realtime server stopped");
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
