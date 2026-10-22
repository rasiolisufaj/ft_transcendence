import { topicFor, type RealtimeEvent } from "@/contracts/events";

const TIMEOUT_MS = 2000;

// publishes event to the browsers listening on its topic
// call after database write has succeed, not before

export async function publish(event: RealtimeEvent): Promise<void> {
  const url = process.env.REALTIME_INTERNAL_URL;
  const secret = process.env.REALTIME_PUBLISH_SECRET;
  if (!url || !secret) {
    console.error("realtime publish skipped: REALTIME_INTERNAL_URL or REALTIME_PUBLISH_SECRET is not set", event.type);
    return;
  }
  try {
    const response = await fetch(`${url}/publish`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${secret}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ topic: topicFor(event), event }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      console.error("realtime publish refused", event.type, response.status);
    }
  } catch (error) {
    console.error("realtime publish failed", event.type, error);
  }
}
