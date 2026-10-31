import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ServerMessage } from "@/contracts/socket";
import { mintTicket } from "@/lib/auth/ticket";
import { backoff, createRealtimeClient, fetchTicket, isEventOn, isNewMessage, wsUrl } from "@/lib/realtime/client";
import { startServer } from "@/realtime/server";

process.env.WS_TICKET_SECRET = "test-secret";

describe("wsUrl", () => {
  it("uses wss on an https page", () => {
    expect(wsUrl({ protocol: "https:", host: "mespapiers.local" }, "abc")).toBe(
      "wss://mespapiers.local/ws?ticket=abc",
    );
  });

  it("uses ws on an http page", () => {
    expect(wsUrl({ protocol: "http:", host: "localhost:3000" }, "abc")).toBe("ws://localhost:3000/ws?ticket=abc");
  });

  it("encodes the ticket", () => {
    expect(wsUrl({ protocol: "https:", host: "mespapiers.local" }, "a+b/c=")).toBe(
      "wss://mespapiers.local/ws?ticket=a%2Bb%2Fc%3D",
    );
  });
});

describe("fetchTicket", () => {
  const answer = (status: number, body: unknown) => async () => Response.json(body, { status });

  it("returns the ticket", async () => {
    expect(await fetchTicket(answer(200, { ticket: "abc" }))).toBe("abc");
  });

  it("returns null when signed out", async () => {
    expect(await fetchTicket(answer(401, { error: "Unauthorized" }))).toBeNull();
  });

  it("returns null on a body without a ticket", async () => {
    expect(await fetchTicket(answer(200, { nope: true }))).toBeNull();
  });

  it("returns null when the network fails", async () => {
    const offline = async () => {
      throw new TypeError("fetch failed");
    };
    expect(await fetchTicket(offline)).toBeNull();
  });
});

describe("createRealtimeClient", () => {
  let running: { stop: () => Promise<void> } | null = null;

  afterEach(async () => {
    await running?.stop();
    running = null;
    vi.restoreAllMocks();
  });

  async function start(isMember = async () => false) {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const realtime = startServer({
      port: 0,
      heartbeatMs: 1000,
      isMember,
      friendsOf: async () => [],
      publishSecret: "publish-secret",
    });
    running = realtime;
    await once(realtime.http, "listening");
    const port = (realtime.http.address() as AddressInfo).port;
    return { ...realtime, url: async () => `ws://localhost:${port}/ws?ticket=${mintTicket("user-1")}` };
  }

  const next = (client: ReturnType<typeof createRealtimeClient>) =>
    new Promise<ServerMessage>((resolve) => {
      const off = client.on((message) => {
        off();
        resolve(message);
      });
    });

  const waitFor = (client: ReturnType<typeof createRealtimeClient>, type: ServerMessage["type"]) =>
    new Promise<ServerMessage>((resolve) => {
      const off = client.on((message) => {
        if (message.type === type) {
          off();
          resolve(message);
        }
      });
    });

  it("passes the server messages to its listeners", async () => {
    const { url } = await start();
    const client = createRealtimeClient(url);

    const hello = next(client);
    await client.connect();

    expect(await hello).toEqual({ type: "hello", userId: "user-1" });
    client.close();
  });

  it("stops calling a listener once it is removed", async () => {
    const { url } = await start();
    const client = createRealtimeClient(url);
    const removed = vi.fn();
    client.on(removed)();

    const hello = next(client);
    await client.connect();
    await hello;

    expect(removed).not.toHaveBeenCalled();
    client.close();
  });

  it("does not connect without a ticket", async () => {
    const { server } = await start();
    const client = createRealtimeClient(async () => null);

    await client.connect();

    expect(server.clients.size).toBe(0);
    client.close();
  });

  it("closes its socket", async () => {
    const { url, server } = await start();
    const client = createRealtimeClient(url);
    const hello = next(client);
    await client.connect();
    await hello;

    const [socket] = server.clients;
    const closed = once(socket!, "close");
    client.close();
    await closed;

    expect(server.clients.size).toBe(0);
  });

  it("sends a subscribe made before the socket is open", async () => {
    const { url } = await start(async () => true);
    const client = createRealtimeClient(url);
    client.subscribe("channel:12");

    const subscribed = waitFor(client, "subscribed");
    await client.connect();

    expect(await subscribed).toEqual({ type: "subscribed", topic: "channel:12" });
    client.close();
  });

  it("subscribes and unsubscribes once connected", async () => {
    const { url } = await start(async () => true);
    const client = createRealtimeClient(url);
    const hello = waitFor(client, "hello");
    await client.connect();
    await hello;

    const subscribed = waitFor(client, "subscribed");
    client.subscribe("channel:12");
    expect(await subscribed).toEqual({ type: "subscribed", topic: "channel:12" });

    const unsubscribed = waitFor(client, "unsubscribed");
    client.unsubscribe("channel:12");
    expect(await unsubscribed).toEqual({ type: "unsubscribed", topic: "channel:12" });
    client.close();
  });
});

describe("backoff", () => {
  it("doubles from the base delay up to the max", () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((attempt) => backoff(attempt, 1000, 30_000))).toEqual([
      1000, 2000, 4000, 8000, 16_000, 30_000, 30_000,
    ]);
  });
});

describe("reconnect", () => {
  let running: { stop: () => Promise<void> } | null = null;
  const fast = { baseDelayMs: 10, maxDelayMs: 50 };
  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  afterEach(async () => {
    await running?.stop();
    running = null;
    vi.restoreAllMocks();
  });

  async function start() {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    const realtime = startServer({
      port: 0,
      heartbeatMs: 1000,
      isMember: async () => true,
      friendsOf: async () => [],
      publishSecret: "publish-secret",
    });
    running = realtime;
    await once(realtime.http, "listening");
    const port = (realtime.http.address() as AddressInfo).port;
    const url = vi.fn(async () => `ws://localhost:${port}/ws?ticket=${mintTicket("user-1")}`);
    return { ...realtime, url };
  }

  const waitFor = (client: ReturnType<typeof createRealtimeClient>, type: ServerMessage["type"]) =>
    new Promise<ServerMessage>((resolve) => {
      const off = client.on((message) => {
        if (message.type === type) {
          off();
          resolve(message);
        }
      });
    });

  function drop(server: { clients: Set<{ terminate: () => void }> }) {
    for (const socket of server.clients) {
      socket.terminate();
    }
  }

  it("reconnects with a fresh ticket after the connection drops", async () => {
    const { url, server } = await start();
    const client = createRealtimeClient(url, fast);
    const hello = waitFor(client, "hello");
    await client.connect();
    await hello;

    const again = waitFor(client, "hello");
    drop(server);

    expect(await again).toEqual({ type: "hello", userId: "user-1" });
    expect(url).toHaveBeenCalledTimes(2);
    client.close();
  });

  it("subscribes again after reconnecting", async () => {
    const { url, server } = await start();
    const client = createRealtimeClient(url, fast);
    const subscribed = waitFor(client, "subscribed");
    client.subscribe("channel:12");
    await client.connect();
    await subscribed;

    const again = waitFor(client, "subscribed");
    drop(server);

    expect(await again).toEqual({ type: "subscribed", topic: "channel:12" });
    client.close();
  });

  it("does not reconnect after close", async () => {
    const { url, server } = await start();
    const client = createRealtimeClient(url, fast);
    const hello = waitFor(client, "hello");
    await client.connect();
    await hello;

    client.close();
    await wait(100);

    expect(url).toHaveBeenCalledTimes(1);
    expect(server.clients.size).toBe(0);
  });

  it("connects again after close, as React does in development", async () => {
    const { url } = await start();
    const client = createRealtimeClient(url, fast);
    void client.connect();
    client.close();

    const hello = waitFor(client, "hello");
    await client.connect();

    expect(await hello).toEqual({ type: "hello", userId: "user-1" });
    client.close();
  });

  it("keeps one socket when close lands during a connect", async () => {
    const { url, server } = await start();
    const client = createRealtimeClient(url, fast);
    const first = client.connect();
    client.close();
    const hello = waitFor(client, "hello");
    await Promise.all([first, client.connect()]);
    await hello;
    await wait(50);

    expect(server.clients.size).toBe(1);
    client.close();
  });

  it("tries again when there is no ticket yet", async () => {
    const { url } = await start();
    url.mockResolvedValueOnce(null as unknown as string);
    const client = createRealtimeClient(url, fast);

    const hello = waitFor(client, "hello");
    await client.connect();

    expect(await hello).toEqual({ type: "hello", userId: "user-1" });
    client.close();
  });
});

describe("isEventOn", () => {
  const event = {
    type: "event",
    topic: "channel:12",
    event: { type: "member.left", channelId: 12, userId: "user-1", at: "2026-10-28T10:00:00.000Z" },
  } as const;

  it("is true for an event on that topic", () => {
    expect(isEventOn(event, "channel:12")).toBe(true);
  });

  it("is false for another topic", () => {
    expect(isEventOn(event, "channel:13")).toBe(false);
  });

  it("is false for a message that is not an event", () => {
    expect(isEventOn({ type: "subscribed", topic: "channel:12" }, "channel:12")).toBe(false);
  });
});

describe("isNewMessage", () => {
  const from = (senderId: string) =>
    ({
      type: "event",
      topic: "user:me",
      event: { type: "message.created", conversationId: 1, messageId: 2, senderId, recipientId: "me", at: "2026-10-30T10:00:00.000Z" },
    }) as const;

  it("is true for a message from that person", () => {
    expect(isNewMessage(from("bob"), "bob")).toBe(true);
  });

  it("is false for a message from someone else", () => {
    expect(isNewMessage(from("carol"), "bob")).toBe(false);
  });

  it("is true for any message when no sender is given", () => {
    expect(isNewMessage(from("carol"))).toBe(true);
  });

  it("is false for another event", () => {
    const left = {
      type: "event",
      topic: "channel:1",
      event: { type: "member.left", channelId: 1, userId: "bob", at: "2026-10-30T10:00:00.000Z" },
    } as const;
    expect(isNewMessage(left)).toBe(false);
  });
});
