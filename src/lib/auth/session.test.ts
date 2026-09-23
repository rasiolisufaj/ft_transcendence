import { describe, expect, it } from "vitest";
import { generateSessionToken, hashToken } from "@/lib/auth/session";

describe("session tokens", () => {
  it("generates a URL-safe token with at least 128 bits of entropy", () => {
    const token = generateSessionToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token.length).toBeGreaterThanOrEqual(22);
  });

  it("never repeats", () => {
    const seen = new Set(Array.from({ length: 500 }, generateSessionToken));
    expect(seen.size).toBe(500);
  });

  it("hashes deterministically to 64 hex chars", () => {
    const token = generateSessionToken();
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(token)).not.toBe(token);
  });
});
