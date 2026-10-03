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
