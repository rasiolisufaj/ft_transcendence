import { config } from "dotenv";
import { log } from "./log";
import { startServer } from "./server";

// npm run realtime runs outside Next, so nobody else loads .env. Already-set variables win (compose).
config({ quiet: true });

// run with -> npm run realtime
const port = Number(process.env.REALTIME_PORT ?? 3001);
const heartbeatMs = Number(process.env.HEARTBEAT_MS ?? 30000);

// Fail at startup, not at the first client: verifyTicket() throws without it.
if (!process.env.WS_TICKET_SECRET) {
  log("error", "WS_TICKET_SECRET is not set");
  process.exit(1);
}

const publishSecret = process.env.REALTIME_PUBLISH_SECRET;
if (!publishSecret) {
  log("error", "REALTIME_PUBLISH_SECRET is not set");
  process.exit(1);
}

const realtime = startServer({ port, heartbeatMs, publishSecret });

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
