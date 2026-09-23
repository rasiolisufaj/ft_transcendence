import { createHash, randomBytes } from "node:crypto";

export const SESSION_COOKIE = "mp_session";

/** 192 bits, base64url so it is safe in a cookie with no encoding. */
export function generateSessionToken(): string {
  return randomBytes(24).toString("base64url");
}

/** The token the browser holds is never stored. Only this digest is, as Session.id. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
