import { once } from "node:events";
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RealtimeEvent } from "@/contracts/events";
import { publish } from "@/lib/realtime/publish";

const event: RealtimeEvent = {
  type: "thread.created",
  channelId: 12,
  threadId: 3,
  actorUserId: "user-1",
  at: "2026-10-22T10:00:00.000Z",
};

let fake: Server;
let received: { request: IncomingMessage; body: string }[];
let status: number | null;

beforeEach(async () => {
  received = [];
  status = 204;
  fake = createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) {
      body += chunk;
    }
    received.push({ request, body });
    if (status) {
      response.writeHead(status).end();
    }
  });
  fake.listen(0);
  await once(fake, "listening");
  process.env.REALTIME_INTERNAL_URL = `http://localhost:${(fake.address() as AddressInfo).port}`;
  process.env.REALTIME_PUBLISH_SECRET = "publish-secret";
});

afterEach(async () => {
  fake.closeAllConnections();
  fake.close();
  await once(fake, "close");
  vi.restoreAllMocks();
});

describe("publish", () => {
  it("posts the event on its topic with the secret", async () => {
    await publish(event);

    expect(received).toHaveLength(1);
    const [{ request, body }] = received as [{ request: IncomingMessage; body: string }];
    expect(request.method).toBe("POST");
    expect(request.url).toBe("/publish");
    expect(request.headers.authorization).toBe("Bearer publish-secret");
    expect(JSON.parse(body)).toEqual({ topic: "channel:12", event });
  });

  it("does not throw when realtime is down", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const closed = createServer().listen(0);
    await once(closed, "listening");
    process.env.REALTIME_INTERNAL_URL = `http://localhost:${(closed.address() as AddressInfo).port}`;
    closed.close();
    await once(closed, "close");

    await expect(publish(event)).resolves.toBeUndefined();
    expect(error).toHaveBeenCalled();
  });

  it("logs when realtime refuses the event", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    status = 401;

    await expect(publish(event)).resolves.toBeUndefined();
    expect(error).toHaveBeenCalled();
  });

  it("gives up when realtime does not answer", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    status = null;

    await expect(publish(event)).resolves.toBeUndefined();
    expect(error).toHaveBeenCalled();
  });

  it("sends nothing when the url is not set", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    delete process.env.REALTIME_INTERNAL_URL;

    await publish(event);
    expect(received).toHaveLength(0);
    expect(error).toHaveBeenCalled();
  });

  it("sends nothing when the secret is not set", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    delete process.env.REALTIME_PUBLISH_SECRET;

    await publish(event);
    expect(received).toHaveLength(0);
    expect(error).toHaveBeenCalled();
  });
});
