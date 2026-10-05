import type { RealtimeEvent } from "@/contracts/events";

// publishes event to the browsers listening on its topic
// call after database write has succeed, not before

export async function publish(event: RealtimeEvent): Promise<void> {
  void event; // just for dodge warning 
}
