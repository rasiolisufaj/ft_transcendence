// C11: 6 failures per 15 minutes per key lock the form. One web process, so an
// in-memory Map is enough (a restart clears it); Redis would be infrastructure
// for a problem this project does not have.
const MAX_ATTEMPTS = 6;
const WINDOW_MS = 15 * 60 * 1000;

export function createRateLimiter() {
  const attempts = new Map<string, { count: number; firstAt: number }>();

  function tooManyAttempts(key: string): boolean {
    const entry = attempts.get(key);
    if (!entry) return false;
    if (Date.now() - entry.firstAt > WINDOW_MS) {
      attempts.delete(key);
      return false;
    }
    return entry.count >= MAX_ATTEMPTS;
  }

  function recordFailure(key: string): void {
    const now = Date.now();
    // Drop expired windows, so a spray of made-up keys cannot grow the Map forever.
    for (const [k, entry] of attempts) if (now - entry.firstAt > WINDOW_MS) attempts.delete(k);
    const entry = attempts.get(key);
    if (entry) entry.count += 1;
    else attempts.set(key, { count: 1, firstAt: now });
  }

  function clearAttempts(key: string): void {
    attempts.delete(key);
  }

  return { tooManyAttempts, recordFailure, clearAttempts };
}
