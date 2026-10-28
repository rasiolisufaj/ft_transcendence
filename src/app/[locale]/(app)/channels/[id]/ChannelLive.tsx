"use client";

import { channelTopic } from "@/contracts/events";
import { useRealtimeMessage, useTopic } from "@/components/RealtimeProvider";
import { useRouter } from "@/i18n/navigation";
import { isEventOn } from "@/lib/realtime/client";

// Re-reads the page from the server on every event of this channel.
export function ChannelLive({ channelId }: { channelId: number }) {
  const router = useRouter();
  const topic = channelTopic(channelId);
  useTopic(topic);
  useRealtimeMessage((message) => {
    if (isEventOn(message, topic)) {
      router.refresh();
    }
  });
  return null;
}
