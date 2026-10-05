import { describe, expect, it, vi } from "vitest";
import { mintTicket, verifyTicket } from "@/lib/auth/ticket";

// Read per call by sign(), so setting it after the import is fine.
process.env.WS_TICKET_SECRET ??= "test-only";

describe("ws ticket", () => {
  it("round-trips the user id", () => {
    const t = mintTicket("user-123");
    expect(verifyTicket(t)).toEqual({ userId: "user-123" });
  });

  it("rejects a tampered ticket", () => {
    const t = mintTicket("user-123");
    expect(verifyTicket(t.replace("user-123", "user-456"))).toBeNull();
  });

  it("rejects a ticket older than 60 seconds", () => {
    const t = mintTicket("user-123");
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 61_000);
    expect(verifyTicket(t)).toBeNull();
    vi.useRealTimers();
  });

  it("rejects a replay", () => {
    const t = mintTicket("user-123");
    expect(verifyTicket(t)).not.toBeNull();
    expect(verifyTicket(t)).toBeNull();
  });

  it("rejects garbage", () => {
    expect(verifyTicket("nonsense")).toBeNull();
  });
});
