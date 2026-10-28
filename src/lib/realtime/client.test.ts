import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ServerMessage } from "@/contracts/socket";
import { mintTicket } from "@/lib/auth/ticket";
import { createRealtimeClient, fetchTicket, wsUrl } from "@/lib/realtime/client";
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

  async function start() {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const realtime = startServer({
      port: 0,
      heartbeatMs: 1000,
      isMember: async () => false,
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
});
