import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WebSocket } from "ws";
import { mintTicket } from "@/lib/auth/ticket";
import { startServer } from "@/realtime/server";

process.env.WS_TICKET_SECRET = "test-secret";

// Every server a test started, stopped after the test.
let running: { stop: () => Promise<void> }[] = [];

// Starts a server on a free port and returns its ws:// address.
async function start(heartbeatMs = 1000) {
  const realtime = startServer({ port: 0, heartbeatMs });
  running.push(realtime);
  await once(realtime.server, "listening");
  const port = (realtime.server.address() as AddressInfo).port;
  return { ...realtime, url: `ws://localhost:${port}` };
}

// The server only accepts a client that brings a valid ticket.
const withTicket = (url: string, userId = "user-1") => `${url}?ticket=${mintTicket(userId)}`;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

beforeEach(() => {
  // The server logs a JSON line per event: keep the test output readable.
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(async () => {
  await Promise.all(running.map((realtime) => realtime.stop()));
  running = [];
  vi.restoreAllMocks();
});

describe("realtime server", () => {
  it("closes clients with 1001 when it stops", async () => {
    const { url, stop } = await start();
    const client = new WebSocket(withTicket(url));
    await once(client, "message");

    const closed = once(client, "close");
    await stop();
    const [code] = await closed;

    expect(code).toBe(1001);
  });
});

describe("heartbeat", () => {
  it("keeps a client that answers the pings", async () => {
    const { url } = await start(50);
    const client = new WebSocket(withTicket(url));
    await once(client, "message");

    await wait(300); // about 6 heartbeats

    expect(client.readyState).toBe(WebSocket.OPEN);
  });

  it("cuts a client that never answers", async () => {
    const { url } = await start(50);
    const client = new WebSocket(withTicket(url), { autoPong: false });
    await once(client, "message");

    const [code] = await once(client, "close");

    expect(code).toBe(1006); // closed without a goodbye: cut by terminate()
  });
});

describe("ticket", () => {
  it("refuses a client without a ticket", async () => {
    const { url } = await start();
    const client = new WebSocket(url);

    const [, response] = await once(client, "unexpected-response");

    expect(response.statusCode).toBe(401);
  });

  it("refuses a client with a bad ticket", async () => {
    const { url } = await start();
    const client = new WebSocket(`${url}?ticket=nimportequoi`);

    const [, response] = await once(client, "unexpected-response");

    expect(response.statusCode).toBe(401);
  });

  it("says hello with the user id of a valid ticket", async () => {
    const { url } = await start();
    const client = new WebSocket(withTicket(url));

    const [data] = await once(client, "message");

    expect(JSON.parse(data.toString())).toEqual({ type: "hello", userId: "user-1" });
  });
});
