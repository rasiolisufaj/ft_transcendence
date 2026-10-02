import type { SessionContext } from "@/lib/auth/session";

// One list, so the type and the runtime default-deny check cannot drift apart.
const ACTIONS = [
  "document:read", "document:create", "document:update", "document:delete",
  "assistant:ask",
  "channel:create", "channel:update", "channel:delete", "channel:join",
  "channel:moderate",                       // hide a post, mute a member; also invite, kick (§C-16)
  "thread:create", "thread:update", "thread:delete",
  "answer:create", "answer:update", "answer:delete", "answer:vote",
  "message:send", "friend:request",
  "user:manage", "channel:manageRoles",     // admin surface
  "gdpr:export", "gdpr:delete",
] as const;

export type Action = (typeof ACTIONS)[number];

/**
 * The caller chooses which fields to pass, and that choice IS the rule:
 *   - pass `ownerUserId` to mean "only the owner of this row may do it"
 *   - pass `channelId`   to mean "a moderator of this channel may also do it", and, for posting, "only members of this channel"
 * So answer:vote is called as { channelId } and never with the author's id —
 * passing it would stop anyone from voting on anyone else's answer.
 */
export type Resource = {
  ownerUserId?: string | null;
  channelId?: number | null;   // Channel.id is Int in the schema — §C-8
};

const ALL_ACTIONS = new Set<string>(ACTIONS);

/** Only a global ADMIN, ever. */
const ADMIN_ONLY = new Set<Action>(["user:manage"]);

/** What a MODERATOR may do inside the channel they moderate — and nowhere else. */
const MODERATOR_ACTIONS = new Set<Action>([
  "channel:moderate", "channel:update", "channel:manageRoles",
  "thread:delete", "answer:delete",
]);

/**
 * Posting inside a channel: any role, but only in a channel you belong to (§C-15).
 * Memberships come from the session, loaded once per request, so a user who joins
 * and posts in the same Server Action has a stale ctx: re-run requireUser() after the join.
 */
const MEMBER_ACTIONS = new Set<Action>(["thread:create", "answer:create", "answer:vote"]);

/** Any signed-in user, acting on their own behalf, with no resource to own. */
const SELF_SERVICE = new Set<Action>([
  "document:create", "assistant:ask",
  "channel:create", "channel:join",
  "message:send", "friend:request",
  "gdpr:export", "gdpr:delete",
]);

export function can(ctx: SessionContext, action: Action, resource: Resource = {}): boolean {
  // Default-deny: an action outside the union loses before any role logic runs.
  if (!ALL_ACTIONS.has(action)) return false;

  // Tier 1 — global admin wins everywhere.
  if (ctx.user.globalRole === "ADMIN") return true;
  if (ADMIN_ONLY.has(action)) return false;

  // Tier 2 — moderator, scoped to exactly one channel.
  if (resource.channelId != null && MODERATOR_ACTIONS.has(action)) {
    const membership = ctx.memberships.find((m) => m.channelId === resource.channelId);
    if (membership?.role === "MODERATOR") return true;
  }

  // Membership — no channelId means no membership can match: denied.
  if (MEMBER_ACTIONS.has(action)) {
    return ctx.memberships.some((m) => m.channelId === resource.channelId);
  }

  // Tier 3 — ownership.
  if (resource.ownerUserId != null) {
    return ctx.user.id === resource.ownerUserId;
  }

  return SELF_SERVICE.has(action);
}

export class ForbiddenError extends Error {
  readonly status = 403;
  constructor(action: Action) {
    super(`Forbidden: ${action}`);
    this.name = "ForbiddenError";
  }
}

export function assertCan(ctx: SessionContext, action: Action, resource: Resource = {}): void {
  if (!can(ctx, action, resource)) throw new ForbiddenError(action);
}
