export const DAY_MS = 24 * 60 * 60 * 1000;

/** A HARD document warns this many days before it expires (PROJECT_PLAN §5, rule 2). */
export const EXPIRING_SOON_DAYS = 90;

export type ExpiryStatus = "VALID" | "EXPIRING_SOON" | "EXPIRED";

/**
 * Where a HARD deadline stands. `targetDate` is the printed expiry day at midnight
 * UTC, as upload stores it, and the document is still valid during that day.
 * deriveStatus() (plan §5, not built yet) should call this for its HARD branch.
 */
export function expiryStatus(targetDate: Date, now: Date = new Date()): ExpiryStatus {
  const daysLeft = (targetDate.getTime() - now.getTime()) / DAY_MS;
  if (daysLeft <= -1) {
    return "EXPIRED";
  }
  if (daysLeft <= EXPIRING_SOON_DAYS) {
    return "EXPIRING_SOON";
  }
  return "VALID";
}
