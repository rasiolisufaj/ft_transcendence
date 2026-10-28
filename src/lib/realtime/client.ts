import type { ClientMessage, ServerMessage } from "@/contracts/socket";

// Off until compose runs realtime and nginx proxies /ws: a failed WebSocket is a Chrome console error.
export function realtimeEnabled(): boolean {
  return process.env.NEXT_PUBLIC_REALTIME === "on";
}

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

export function backoff(attempt: number, baseMs: number, maxMs: number): number {
  return Math.min(baseMs * 2 ** attempt, maxMs);
}

export function createRealtimeClient(
  connectUrl: () => Promise<string | null>,
  { baseDelayMs = 1000, maxDelayMs = 30_000 } = {},
) {
  const listeners = new Set<Listener>();
  const topics = new Set<string>();
  let socket: WebSocket | null = null;
  let closed = false;
  let attempt = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function retry() {
    if (closed) {
      return;
    }
    timer = setTimeout(() => {
      timer = null;
      void connect();
    }, backoff(attempt, baseDelayMs, maxDelayMs));
    attempt += 1;
  }

  function send(message: ClientMessage) {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }

  async function connect() {
    const url = await connectUrl();
    if (closed) {
      return;
    }
    if (!url) {
      retry();
      return;
    }
    const current = new WebSocket(url);
    socket = current;
    current.addEventListener("open", () => {
      attempt = 0;
      for (const topic of topics) {
        send({ type: "subscribe", topic });
      }
    });
    current.addEventListener("close", () => {
      if (socket !== current) {
        return;
      }
      socket = null;
      retry();
    });
    current.addEventListener("message", (event) => {
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

  function subscribe(topic: string) {
    topics.add(topic);
    send({ type: "subscribe", topic });
  }

  function unsubscribe(topic: string) {
    topics.delete(topic);
    send({ type: "unsubscribe", topic });
  }

  function close() {
    closed = true;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    const current = socket;
    socket = null;
    current?.close();
  }

  return { connect, on, subscribe, unsubscribe, close };
}
