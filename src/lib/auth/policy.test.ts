import { describe, expect, it } from "vitest";
import { ForbiddenError, assertCan, can, type Action } from "@/lib/auth/policy";
import type { SessionContext } from "@/lib/auth/session";

const CHANNEL = 7;
const OTHER_CHANNEL = 8;

function ctx(over: {
  id?: string;
  globalRole?: "USER" | "ADMIN";
  reputation?: number;
  memberships?: SessionContext["memberships"];
} = {}): SessionContext {
  return {
    session: { id: "s", expiresAt: new Date(Date.now() + 1000), twoFactorVerified: false },
    user: {
      id: over.id ?? "u-self",
      email: "a@b.com",
      displayName: "A",
      avatarKey: null,
      locale: "fr",
      totpEnabled: false,
      globalRole: over.globalRole ?? "USER",
      reputation: over.reputation ?? 0,
    },
    memberships: over.memberships ?? [],
  };
}

const admin = ctx({ globalRole: "ADMIN" });
const moderator = ctx({ memberships: [{ channelId: CHANNEL, role: "MODERATOR" }] });
const member = ctx({ memberships: [{ channelId: CHANNEL, role: "MEMBER" }] });
const stranger = ctx();

describe("default-deny", () => {
  it("denies an action outside the union, even for an admin", () => {
    // `as unknown as Action` — a plain `as Action` is a compile error, because
    // TypeScript refuses a cast between literal types that do not overlap.
    expect(can(admin, "document:teleport" as unknown as Action, {})).toBe(false);
    expect(can(admin, "" as unknown as Action, {})).toBe(false);
  });
});

describe("tier 1 — global admin", () => {
  it("grants everything", () => {
    expect(can(admin, "user:manage", {})).toBe(true);
    expect(can(admin, "document:delete", { ownerUserId: "someone-else" })).toBe(true);
    expect(can(admin, "channel:moderate", { channelId: OTHER_CHANNEL })).toBe(true);
  });

  it("user:manage is admin-only, even on your own account", () => {
    // Without ADMIN_ONLY this falls through to ownership: a user could promote themselves.
    expect(can(stranger, "user:manage", { ownerUserId: "u-self" })).toBe(false);
  });
});

describe("tier 2 — channel moderator", () => {
  it("moderates its own channel", () => {
    expect(can(moderator, "channel:moderate", { channelId: CHANNEL })).toBe(true);
    expect(can(moderator, "thread:delete", { channelId: CHANNEL, ownerUserId: "x" })).toBe(true);
    expect(can(moderator, "answer:delete", { channelId: CHANNEL, ownerUserId: "x" })).toBe(true);
    expect(can(moderator, "channel:manageRoles", { channelId: CHANNEL })).toBe(true);
  });

  it("does not moderate any other channel", () => {
    expect(can(moderator, "channel:moderate", { channelId: OTHER_CHANNEL })).toBe(false);
    expect(can(moderator, "thread:delete", { channelId: OTHER_CHANNEL, ownerUserId: "x" })).toBe(false);
  });

  it("is not a global admin", () => {
    expect(can(moderator, "user:manage", {})).toBe(false);
  });

  it("a plain MEMBER moderates nothing", () => {
    expect(can(member, "channel:moderate", { channelId: CHANNEL })).toBe(false);
    expect(can(member, "thread:delete", { channelId: CHANNEL, ownerUserId: "x" })).toBe(false);
  });
});

describe("tier 3 — ownership", () => {
  it("grants the owner and denies everyone else", () => {
    expect(can(stranger, "document:read", { ownerUserId: "u-self" })).toBe(true);
    expect(can(stranger, "document:update", { ownerUserId: "u-self" })).toBe(true);
    expect(can(stranger, "document:delete", { ownerUserId: "u-self" })).toBe(true);
    expect(can(stranger, "document:read", { ownerUserId: "u-other" })).toBe(false);
    expect(can(stranger, "document:delete", { ownerUserId: "u-other" })).toBe(false);
  });

  it("deleting a channel is its creator's call, not a moderator's", () => {
    // Called as { channelId, ownerUserId: channel.createdBy }.
    expect(can(stranger, "channel:delete", { channelId: CHANNEL, ownerUserId: "u-self" })).toBe(true);
    expect(can(moderator, "channel:delete", { channelId: CHANNEL, ownerUserId: "x" })).toBe(false);
    // createdBy is SetNull when the creator is deleted: only an admin can remove it then.
    expect(can(moderator, "channel:delete", { channelId: CHANNEL, ownerUserId: null })).toBe(false);
  });
});

describe("self-service actions", () => {
  it("any signed-in user may act on their own behalf", () => {
    expect(can(stranger, "document:create", {})).toBe(true);
    expect(can(stranger, "channel:create", {})).toBe(true);
    // Public vs private is Channel.isPrivate, checked by the action's query, not here.
    expect(can(stranger, "channel:join", { channelId: OTHER_CHANNEL })).toBe(true);
    expect(can(stranger, "gdpr:export", {})).toBe(true);
  });
});

describe("posting needs a membership in that channel", () => {
  it("a member posts, answers and votes in their own channel", () => {
    expect(can(member, "thread:create", { channelId: CHANNEL })).toBe(true);
    expect(can(member, "answer:create", { channelId: CHANNEL })).toBe(true);
    expect(can(member, "answer:vote", { channelId: CHANNEL })).toBe(true);
    expect(can(moderator, "answer:create", { channelId: CHANNEL })).toBe(true);
  });

  it("nobody posts where they are not a member, or with no channel at all", () => {
    expect(can(member, "thread:create", { channelId: OTHER_CHANNEL })).toBe(false);
    expect(can(stranger, "answer:create", { channelId: CHANNEL })).toBe(false);
    expect(can(stranger, "answer:vote", { channelId: CHANNEL })).toBe(false);
    expect(can(member, "thread:create", {})).toBe(false);
  });
});

describe("reputation is a badge, not a tier", () => {
  it("grants nothing at any level", () => {
    const helper = ctx({ reputation: 10_000 });
    expect(can(helper, "channel:moderate", { channelId: CHANNEL })).toBe(false);
    expect(can(helper, "thread:delete", { channelId: CHANNEL, ownerUserId: "x" })).toBe(false);
    expect(can(helper, "user:manage", {})).toBe(false);
    expect(can(helper, "document:read", { ownerUserId: "u-other" })).toBe(false);
  });
});

describe("assertCan", () => {
  it("is silent when allowed", () => {
    expect(() => assertCan(admin, "user:manage", {})).not.toThrow();
  });

  it("throws a 403 when denied", () => {
    expect(() => assertCan(stranger, "user:manage", {})).toThrow(ForbiddenError);
    try {
      assertCan(stranger, "user:manage", {});
    } catch (e) {
      expect((e as ForbiddenError).status).toBe(403);
    }
  });
});
