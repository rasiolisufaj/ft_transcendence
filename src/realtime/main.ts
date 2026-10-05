import { log } from "./log";
import { startServer } from "./server";

// run with -> npm run realtime
const port = Number(process.env.REALTIME_PORT ?? 3001);
const heartbeatMs = Number(process.env.HEARTBEAT_MS ?? 30000);

const realtime = startServer({ port, heartbeatMs });

let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  log("info", "shutting down", { signal, clients: realtime.server.clients.size });

  await realtime.stop();
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
