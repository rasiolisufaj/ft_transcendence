import { hash, verify } from "@node-rs/argon2";

/** Argon2id with the library defaults (PROJECT_PLAN.md §2). The salt is generated
 *  per call and embedded in the returned string, so no separate salt column. */
export function hashPassword(password: string): Promise<string> {
  return hash(password);
}

export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  try {
    return await verify(storedHash, password);
  } catch {
    // Malformed or truncated hash — treat as a failed login, never a 500.
    return false;
  }
}
