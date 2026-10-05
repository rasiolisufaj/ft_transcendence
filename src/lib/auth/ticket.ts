import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const TTL_MS = 60_000;

/** nonce -> expiry. Pruned lazily on use; no timers, so fake timers in tests
 *  and `setTimeout().unref()` typing under lib.dom both stop being a problem. */
const used = new Map<string, number>();

function sign(payload: string): string {
  // Read per call, not at import: `next build` imports the route without the key.
  // No fallback: a default secret in the source lets anyone mint tickets.
  const secret = process.env.WS_TICKET_SECRET;
  if (!secret) throw new Error("WS_TICKET_SECRET is not set");
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function mintTicket(userId: string): string {
  const payload = `${userId}.${Date.now() + TTL_MS}.${randomBytes(9).toString("base64url")}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyTicket(ticket: string): { userId: string } | null {
  const parts = ticket.split(".");
  if (parts.length !== 4) return null;
  const [userId, expiry, nonce, mac] = parts as [string, string, string, string];

  const expected = Buffer.from(sign(`${userId}.${expiry}.${nonce}`));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  const now = Date.now();
  if (Number(expiry) <= now) return null;
  if (used.has(nonce)) return null;

  for (const [n, exp] of used) if (exp <= now) used.delete(n);
  used.set(nonce, now + TTL_MS);
  return { userId };
}
