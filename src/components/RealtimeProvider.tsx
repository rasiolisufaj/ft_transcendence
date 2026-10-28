"use client";

import { createContext, useContext, useEffect, useEffectEvent, useState, type ReactNode } from "react";
import type { ServerMessage } from "@/contracts/socket";
import { createRealtimeClient, fetchTicket, realtimeEnabled, wsUrl } from "@/lib/realtime/client";
import { applyPresence, type OnlineFriends } from "@/lib/realtime/presence";

type RealtimeClient = ReturnType<typeof createRealtimeClient>;

const RealtimeContext = createContext<{ client: RealtimeClient | null; online: OnlineFriends }>({
  client: null,
  online: null,
});

async function connectUrl() {
  const ticket = await fetchTicket();
  return ticket ? wsUrl(window.location, ticket) : null;
}

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => (realtimeEnabled() ? createRealtimeClient(connectUrl) : null));
  const [online, setOnline] = useState<OnlineFriends>(null);

  useEffect(() => {
    if (!client) {
      return;
    }
    const off = client.on((message) => setOnline((current) => applyPresence(current, message)));
    void client.connect();
    return () => {
      off();
      client.close();
    };
  }, [client]);

  return <RealtimeContext value={{ client, online }}>{children}</RealtimeContext>;
}

export function useRealtimeMessage(listener: (message: ServerMessage) => void) {
  const { client } = useContext(RealtimeContext);
  const onMessage = useEffectEvent(listener);

  useEffect(() => client?.on((message) => onMessage(message)), [client]);
}

// null until the realtime server has said who is online: callers keep their lastSeenAt value.
export function useOnlineFriends(): OnlineFriends {
  return useContext(RealtimeContext).online;
}
