"use client";

import { useRealtimeMessage } from "@/components/RealtimeProvider";
import { useRouter } from "@/i18n/navigation";
import { isNewMessage } from "@/lib/realtime/client";

// The user's own topic is subscribed on connect: no useTopic here.
export function MessagesLive({ from }: { from?: string }) {
  const router = useRouter();
  useRealtimeMessage((message) => {
    if (isNewMessage(message, from)) {
      router.refresh();
    }
  });
  return null;
}
