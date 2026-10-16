import { describe, expect, it } from "vitest";
import { canSubscribe, readTicket } from "@/realtime/handshake";

describe("readTicket", () => {
  it("reads the ticket from the query string", () => {
    expect(readTicket("/ws?ticket=abc")).toBe("abc");
  });

  it("returns null when there is no ticket", () => {
    expect(readTicket("/ws")).toBeNull();
  });

  it("returns null when there is no path", () => {
    expect(readTicket(undefined)).toBeNull();
  });
});

describe("canSubscribe", () => {
  it("allows the user's own topic", () => {
    expect(canSubscribe("abc", "user:abc")).toBe(true);
  });

  it("refuses another user's topic", () => {
    expect(canSubscribe("abc", "user:bob")).toBe(false);
  });

  it("refuses a channel topic for now", () => {
    expect(canSubscribe("abc", "channel:1")).toBe(false);
  });

  it("refuses a topic it cannot read", () => {
    expect(canSubscribe("abc", "admin")).toBe(false);
  });
});
