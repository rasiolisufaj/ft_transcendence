import { WebSocketServer } from "ws";

// run with -> npm run realtime
const port = Number(process.env.REALTIME_PORT ?? 3001);

const server = new WebSocketServer({ port });

server.on("listening", () => {
  console.log(`realtime server listening on port ${port}`);
});

server.on("connection", (socket) => {
  console.log("client connected");
  socket.send(JSON.stringify({ type: "hello" }));

  socket.on("close", () => {
    console.log("client disconnected");
  });
});
