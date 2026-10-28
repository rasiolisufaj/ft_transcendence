import type { ServerMessage } from "@/contracts/socket";

type PageLocation = { protocol: string; host: string };

export function wsUrl(location: PageLocation, ticket: string): string {
  const scheme = location.protocol === "https:" ? "wss:" : "ws:";
  return `${scheme}//${location.host}/ws?ticket=${encodeURIComponent(ticket)}`;
}

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

export async function fetchTicket(fetcher: Fetcher = fetch): Promise<string | null> {
  try {
    const response = await fetcher("/api/auth/ws-ticket", { method: "POST" });
    if (!response.ok) {
      return null;
    }
    const body: unknown = await response.json();
    if (typeof body === "object" && body !== null && "ticket" in body && typeof body.ticket === "string") {
      return body.ticket;
    }
    return null;
  } catch {
    return null;
  }
}

type Listener = (message: ServerMessage) => void;

function parse(data: unknown): ServerMessage | null {
  if (typeof data !== "string") {
    return null;
  }
  try {
    return JSON.parse(data) as ServerMessage;
  } catch {
    return null;
  }
}

export function createRealtimeClient(connectUrl: () => Promise<string | null>) {
  const listeners = new Set<Listener>();
  let socket: WebSocket | null = null;

  async function connect() {
    const url = await connectUrl();
    if (!url) {
      return;
    }
    socket = new WebSocket(url);
    socket.addEventListener("message", (event) => {
      const message = parse(event.data);
      if (!message) {
        return;
      }
      for (const listener of listeners) {
        listener(message);
      }
    });
  }

  function on(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  function close() {
    socket?.close();
    socket = null;
  }

  return { connect, on, close };
}
