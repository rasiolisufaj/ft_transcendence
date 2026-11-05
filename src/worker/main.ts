import { setTimeout as sleep } from "node:timers/promises";
import { config } from "dotenv";
import { scanDeadlines } from "./scan";

// npm run worker runs outside Next, so nobody else loads .env. Already-set variables win (compose).
config({ quiet: true });

// ponytail: each minute re-reads every HARD document due within 90 days, expired ones
// included forever; leave out the already-notified ones in the query if that ever shows.
const INTERVAL_MS = 60_000;

// One scan at a time: the next starts a minute after the last one ends. Stopping mid-scan
// loses nothing, since the unique index lets the next run redo it.
async function run() {
  console.log("deadline worker started");
  for (;;) {
    try {
      const created = await scanDeadlines();
      if (created > 0) {
        console.log(`deadline scan: ${created} notification(s)`);
      }
    } catch (error) {
      console.error("deadline scan failed", error);
    }
    await sleep(INTERVAL_MS);
  }
}

void run();
