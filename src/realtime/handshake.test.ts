import { describe, expect, it, vi } from "vitest";
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
  const member = async () => true;
  const stranger = async () => false;

  it("allows the user's own topic", async () => {
    expect(await canSubscribe("abc", "user:abc", stranger)).toBe(true);
  });

  it("refuses another user's topic", async () => {
    expect(await canSubscribe("abc", "user:bob", member)).toBe(false);
  });

  it("allows a channel the user is a member of", async () => {
    expect(await canSubscribe("abc", "channel:1", member)).toBe(true);
  });

  it("refuses a channel the user has not joined", async () => {
    expect(await canSubscribe("abc", "channel:1", stranger)).toBe(false);
  });

  it("asks about the right user and channel", async () => {
    const isMember = vi.fn(async () => true);

    await canSubscribe("abc", "channel:12", isMember);

    expect(isMember).toHaveBeenCalledWith("abc", 12);
  });

  it("refuses a topic it cannot read", async () => {
    expect(await canSubscribe("abc", "admin", member)).toBe(false);
  });
});
