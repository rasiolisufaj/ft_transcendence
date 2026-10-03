import { WebSocketServer } from "ws";
import { log } from "./log";

// run with -> npm run realtime
const port = Number(process.env.REALTIME_PORT ?? 3001);

const server = new WebSocketServer({ port });

server.on("listening", () => {
  log("info", "realtime server listening", { port });
});

server.on("error", (error) => {
  log("error", "realtime server error", { error: error.message });
});

server.on("connection", (socket) => {
  log("info", "client connected", { clients: server.clients.size });
  socket.send(JSON.stringify({ type: "hello" }));

  socket.on("close", () => {
    log("info", "client disconnected", { clients: server.clients.size });
  });
});

let shuttingDown = false;

function shutdown(signal: string) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  log("info", "shutting down", { signal, clients: server.clients.size });

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
