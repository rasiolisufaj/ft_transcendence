import { describe, expect, it } from "vitest";
import { applyPresence } from "@/lib/realtime/presence";

describe("applyPresence", () => {
  it("starts empty on hello, then the server lists who is online", () => {
    expect(applyPresence(null, { type: "hello", userId: "me" })).toEqual(new Set());
    expect(applyPresence(new Set(["user-1"]), { type: "hello", userId: "me" })).toEqual(new Set());
  });

  it("adds a friend who comes online", () => {
    expect(applyPresence(new Set(), { type: "presence", userId: "user-1", online: true })).toEqual(
      new Set(["user-1"]),
    );
  });

  it("removes a friend who goes offline", () => {
    expect(applyPresence(new Set(["user-1"]), { type: "presence", userId: "user-1", online: false })).toEqual(
      new Set(),
    );
  });

  it("returns a new set, so React sees the change", () => {
    const before = new Set<string>();
    expect(applyPresence(before, { type: "presence", userId: "user-1", online: true })).not.toBe(before);
  });

  it("keeps the same set for other messages", () => {
    const before = new Set(["user-1"]);
    expect(applyPresence(before, { type: "subscribed", topic: "channel:1" })).toBe(before);
  });

  it("stays null until hello", () => {
    expect(applyPresence(null, { type: "subscribed", topic: "channel:1" })).toBeNull();
  });
});
