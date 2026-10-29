import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WebSocket } from "ws";
import { mintTicket } from "@/lib/auth/ticket";
import type { FriendsOf } from "@/realtime/friends";
import type { IsMember } from "@/realtime/handshake";
import { startServer } from "@/realtime/server";

process.env.WS_TICKET_SECRET = "test-secret";

// Every server a test started, stopped after the test.
let running: { stop: () => Promise<void> }[] = [];

// Starts a server on a free port and returns its ws:// address.
async function start(heartbeatMs = 1000, isMember: IsMember = async () => false, friendsOf: FriendsOf = async () => []) {
  const realtime = startServer({ port: 0, heartbeatMs, isMember, friendsOf, publishSecret: "publish-secret" });
  running.push(realtime);
  await once(realtime.http, "listening");
  const port = (realtime.http.address() as AddressInfo).port;
  return { ...realtime, url: `ws://localhost:${port}` };
}

// The server only accepts a client that brings a valid ticket.
const withTicket = (url: string, userId = "user-1") => `${url}?ticket=${mintTicket(userId)}`;

const httpUrl = (url: string) => url.replace("ws://", "http://");

const publish = (url: string, body: string) =>
  fetch(`${httpUrl(url)}/publish`, {
    method: "POST",
    headers: { authorization: "Bearer publish-secret" },
    body,
  });

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

  it("stops listening as soon as it starts stopping", async () => {
    const { url, http, stop } = await start();
    const client = new WebSocket(withTicket(url));
    await once(client, "message");

    const stopping = stop();
    expect(http.listening).toBe(false);
    await stopping;
  });

  it("stops listening when it stops", async () => {
    const { http, stop } = await start();
    await stop();
    expect(http.listening).toBe(false);
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

describe("client messages", () => {
  it("answers badRequest to something that is not JSON", async () => {
    const { url } = await start();
    const client = new WebSocket(withTicket(url));
    await once(client, "message");

    client.send("not json");
    const [data] = await once(client, "message");

    expect(JSON.parse(data.toString())).toEqual({ type: "error", code: "badRequest" });
  });

  it("answers badRequest to an unknown message type", async () => {
    const { url } = await start();
    const client = new WebSocket(withTicket(url));
    await once(client, "message");

    client.send(JSON.stringify({ type: "publish", topic: "user:user-1" }));
    const [data] = await once(client, "message");

    expect(JSON.parse(data.toString())).toEqual({ type: "error", code: "badRequest" });
  });

  it("closes a client that sends a message over 4 KB", async () => {
    const { url } = await start();
    const client = new WebSocket(withTicket(url));
    await once(client, "message");

    client.send("x".repeat(5000));
    const [code] = await once(client, "close");

    expect(code).toBe(1009);
  });
});

describe("subscriptions", () => {
  async function ask(message: object, isMember?: IsMember) {
    const { url } = await start(1000, isMember);
    const client = new WebSocket(withTicket(url, "user-1"));
    await once(client, "message");

    client.send(JSON.stringify(message));
    const [data] = await once(client, "message");
    return JSON.parse(data.toString());
  }

  it("subscribes a user to their own topic", async () => {
    expect(await ask({ type: "subscribe", topic: "user:user-1" })).toEqual({
      type: "subscribed",
      topic: "user:user-1",
    });
  });

  it("refuses another user's topic", async () => {
    expect(await ask({ type: "subscribe", topic: "user:bob" })).toEqual({
      type: "error",
      code: "forbidden",
      topic: "user:bob",
    });
  });

  it("subscribes a member to their channel", async () => {
    expect(await ask({ type: "subscribe", topic: "channel:1" }, async () => true)).toEqual({
      type: "subscribed",
      topic: "channel:1",
    });
  });

  it("refuses a channel the user has not joined", async () => {
    expect(await ask({ type: "subscribe", topic: "channel:1" }, async () => false)).toEqual({
      type: "error",
      code: "forbidden",
      topic: "channel:1",
    });
  });

  it("refuses the channel when the membership check fails", async () => {
    const broken = async () => {
      throw new Error("database is down");
    };

    expect(await ask({ type: "subscribe", topic: "channel:1" }, broken)).toEqual({
      type: "error",
      code: "forbidden",
      topic: "channel:1",
    });
  });

  it("ends unsubscribed when an unsubscribe follows the subscribe at once", async () => {
    const slow: IsMember = async () => {
      await wait(50);
      return true;
    };
    const { url } = await start(1000, slow);
    const client = new WebSocket(withTicket(url, "user-1"));
    await once(client, "message");
    client.send(JSON.stringify({ type: "subscribe", topic: "channel:12" }));
    client.send(JSON.stringify({ type: "unsubscribe", topic: "channel:12" }));
    await wait(100);

    const received = once(client, "message");
    await publish(url, JSON.stringify({ topic: "channel:12", event: { type: "first" } }));
    await publish(url, JSON.stringify({ topic: "user:user-1", event: { type: "second" } }));
    const [data] = await received;

    expect(JSON.parse(data.toString()).event).toEqual({ type: "second" });
  });

  it("unsubscribes from a topic", async () => {
    expect(await ask({ type: "unsubscribe", topic: "user:user-1" })).toEqual({
      type: "unsubscribed",
      topic: "user:user-1",
    });
  });
});

describe("http", () => {
  it("answers 404 to an unknown route", async () => {
    const { url } = await start();
    const response = await fetch(`${httpUrl(url)}/nope`);
    expect(response.status).toBe(404);
  });

  it("refuses publish without the secret", async () => {
    const { url } = await start();
    const response = await fetch(`${httpUrl(url)}/publish`, { method: "POST" });
    expect(response.status).toBe(401);
  });

  it("refuses publish with a wrong secret", async () => {
    const { url } = await start();
    const response = await fetch(`${httpUrl(url)}/publish`, {
      method: "POST",
      headers: { authorization: "Bearer wrong" },
    });
    expect(response.status).toBe(401);
  });

  it("refuses a body that is not JSON", async () => {
    const { url } = await start();
    const response = await publish(url, "not json");
    expect(response.status).toBe(400);
  });

  it("refuses a bad topic", async () => {
    const { url } = await start();
    const response = await publish(url, JSON.stringify({ topic: "admin", event: { type: "thread.created" } }));
    expect(response.status).toBe(400);
  });

  it("refuses a body without event", async () => {
    const { url } = await start();
    const response = await publish(url, JSON.stringify({ topic: "channel:12" }));
    expect(response.status).toBe(400);
  });

  it("refuses a body over 64 KB", async () => {
    const { url } = await start();
    const response = await publish(url, "x".repeat(70_000));
    expect(response.status).toBe(413);
  });

  it("accepts a valid publish", async () => {
    const { url } = await start();
    const response = await publish(url, JSON.stringify({ topic: "channel:12", event: { type: "thread.created" } }));
    expect(response.status).toBe(204);
  });
});

describe("fan-out", () => {
  it("sends an event to a client on its own topic", async () => {
    const { url } = await start();
    const client = new WebSocket(withTicket(url, "user-1"));
    await once(client, "message");

    const event = { type: "thread.created", channelId: 12 };
    const received = once(client, "message");
    await publish(url, JSON.stringify({ topic: "user:user-1", event }));
    const [data] = await received;

    expect(JSON.parse(data.toString())).toEqual({ type: "event", topic: "user:user-1", event });
  });

  it("does not send an event to a client that is not subscribed", async () => {
    const { url } = await start();
    const client = new WebSocket(withTicket(url, "user-2"));
    await once(client, "message");

    const received = once(client, "message");
    await publish(url, JSON.stringify({ topic: "user:user-1", event: { type: "first" } }));
    await publish(url, JSON.stringify({ topic: "user:user-2", event: { type: "second" } }));
    const [data] = await received;

    expect(JSON.parse(data.toString()).event).toEqual({ type: "second" });
  });

  it("sends a channel event to a subscribed member", async () => {
    const { url } = await start(1000, async () => true);
    const client = new WebSocket(withTicket(url, "user-1"));
    await once(client, "message");
    client.send(JSON.stringify({ type: "subscribe", topic: "channel:12" }));
    await once(client, "message");

    const event = { type: "thread.created", channelId: 12 };
    const received = once(client, "message");
    await publish(url, JSON.stringify({ topic: "channel:12", event }));
    const [data] = await received;

    expect(JSON.parse(data.toString())).toEqual({ type: "event", topic: "channel:12", event });
  });
});

describe("member.left", () => {
  async function member(url: string, userId: string) {
    const client = new WebSocket(withTicket(url, userId));
    await once(client, "message");
    client.send(JSON.stringify({ type: "subscribe", topic: "channel:12" }));
    await once(client, "message");
    return client;
  }

  const left = (userId: string) => ({ type: "member.left", channelId: 12, userId });

  it("still sends member.left to the member who left", async () => {
    const { url } = await start(1000, async () => true);
    const client = await member(url, "user-1");

    const received = once(client, "message");
    await publish(url, JSON.stringify({ topic: "channel:12", event: left("user-1") }));
    const [data] = await received;

    expect(JSON.parse(data.toString()).event).toEqual(left("user-1"));
  });

  it("stops sending the channel to the member who left", async () => {
    const { url } = await start(1000, async () => true);
    const client = await member(url, "user-1");
    const gone = once(client, "message");
    await publish(url, JSON.stringify({ topic: "channel:12", event: left("user-1") }));
    await gone;

    const received = once(client, "message");
    await publish(url, JSON.stringify({ topic: "channel:12", event: { type: "first" } }));
    await publish(url, JSON.stringify({ topic: "user:user-1", event: { type: "second" } }));
    const [data] = await received;

    expect(JSON.parse(data.toString()).event).toEqual({ type: "second" });
  });

  it("keeps the other members subscribed", async () => {
    const { url } = await start(1000, async () => true);
    await member(url, "user-1");
    const other = await member(url, "user-2");
    const gone = once(other, "message");
    await publish(url, JSON.stringify({ topic: "channel:12", event: left("user-1") }));
    await gone;

    const received = once(other, "message");
    await publish(url, JSON.stringify({ topic: "channel:12", event: { type: "next" } }));
    const [data] = await received;

    expect(JSON.parse(data.toString()).event).toEqual({ type: "next" });
  });
});

describe("presence", () => {
  const friends: FriendsOf = async (userId) => {
    const graph: Record<string, string[]> = { "user-1": ["user-2"], "user-2": ["user-1"] };
    return graph[userId] ?? [];
  };

  // Collects the next n messages, listening from now on so none is missed.
  function take(client: WebSocket, n: number): Promise<{ type: string; [key: string]: unknown }[]> {
    return new Promise((resolve) => {
      const got: { type: string }[] = [];
      client.on("message", function collect(data) {
        got.push(JSON.parse(data.toString()));
        if (got.length === n) {
          client.off("message", collect);
          resolve(got);
        }
      });
    });
  }

  async function connect(url: string, userId: string) {
    const client = new WebSocket(withTicket(url, userId));
    await take(client, 1);
    return client;
  }

  // A marker on the user's own topic: if it comes first, nothing else was sent before it.
  const marker = (url: string, userId: string) =>
    publish(url, JSON.stringify({ topic: `user:${userId}`, event: { type: "marker" } }));

  it("tells a friend when a user comes online", async () => {
    const { url } = await start(1000, undefined, friends);
    const bob = await connect(url, "user-2");

    const received = take(bob, 1);
    await connect(url, "user-1");

    expect(await received).toEqual([{ type: "presence", userId: "user-1", online: true }]);
  });

  it("tells a friend when a user goes offline", async () => {
    const { url } = await start(1000, undefined, friends);
    const bob = await connect(url, "user-2");
    const online = take(bob, 1);
    const alice = await connect(url, "user-1");
    await online;

    const received = take(bob, 1);
    alice.close();

    expect(await received).toEqual([{ type: "presence", userId: "user-1", online: false }]);
  });

  it("does not announce a second tab", async () => {
    const { url } = await start(1000, undefined, friends);
    const bob = await connect(url, "user-2");
    const online = take(bob, 1);
    await connect(url, "user-1");
    await online;

    const received = take(bob, 1);
    await connect(url, "user-1");
    await marker(url, "user-2");

    expect((await received)[0]?.type).toBe("event");
  });

  it("stays online while another tab is open", async () => {
    const { url } = await start(1000, undefined, friends);
    const bob = await connect(url, "user-2");
    const online = take(bob, 1);
    const tab = await connect(url, "user-1");
    await connect(url, "user-1");
    await online;

    const received = take(bob, 1);
    tab.close();
    await once(tab, "close");
    await wait(50);
    await marker(url, "user-2");

    expect((await received)[0]?.type).toBe("event");
  });

  it("does not tell someone who is not a friend", async () => {
    const { url } = await start(1000, undefined, friends);
    const carol = await connect(url, "user-3");

    const received = take(carol, 1);
    await connect(url, "user-1");
    await marker(url, "user-3");

    expect((await received)[0]?.type).toBe("event");
  });

  it("keeps working when the friends lookup fails", async () => {
    const broken: FriendsOf = async () => {
      throw new Error("database is down");
    };
    const { url } = await start(1000, undefined, broken);
    const alice = await connect(url, "user-1");

    const received = take(alice, 1);
    await marker(url, "user-1");

    expect((await received)[0]?.type).toBe("event");
  });

  it("looks friends up once on a first connection", async () => {
    const lookup = vi.fn(friends);
    const { url } = await start(1000, undefined, lookup);
    const alice = new WebSocket(withTicket(url, "user-1"));
    await once(alice, "message");
    await wait(50);

    expect(lookup).toHaveBeenCalledTimes(1);
  });

  it("tells a newcomer which friends are already online", async () => {
    const { url } = await start(1000, undefined, friends);
    await connect(url, "user-2");

    const alice = new WebSocket(withTicket(url, "user-1"));
    const [, first] = await take(alice, 2);

    expect(first).toEqual({ type: "presence", userId: "user-2", online: true });
  });

  it("does not list friends who are offline", async () => {
    const { url } = await start(1000, undefined, friends);
    const alice = new WebSocket(withTicket(url, "user-1"));
    const messages = take(alice, 2);
    await once(alice, "open");
    await wait(50);
    await marker(url, "user-1");
    const [, first] = await messages;

    expect(first?.type).toBe("event");
  });
});
