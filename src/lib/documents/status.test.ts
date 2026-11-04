import { describe, expect, it } from "vitest";
import { DAY_MS, EXPIRING_SOON_DAYS, expiryStatus } from "@/lib/documents/status";

// As upload stores it: the printed day at midnight UTC.
const EXPIRY = new Date("2027-03-15T00:00:00Z");
const daysBefore = (days: number) => new Date(EXPIRY.getTime() - days * DAY_MS);

describe("expiryStatus", () => {
  it("is VALID more than 90 days ahead", () => {
    expect(expiryStatus(EXPIRY, daysBefore(EXPIRING_SOON_DAYS + 1))).toBe("VALID");
  });

  it("is EXPIRING_SOON from 90 days ahead", () => {
    expect(expiryStatus(EXPIRY, daysBefore(EXPIRING_SOON_DAYS))).toBe("EXPIRING_SOON");
  });

  it("is still EXPIRING_SOON on the expiry day itself", () => {
    expect(expiryStatus(EXPIRY, new Date("2027-03-15T18:00:00Z"))).toBe("EXPIRING_SOON");
  });

  it("is EXPIRED once the expiry day is over", () => {
    expect(expiryStatus(EXPIRY, new Date("2027-03-16T00:00:00Z"))).toBe("EXPIRED");
    expect(expiryStatus(EXPIRY, new Date("2030-01-01T00:00:00Z"))).toBe("EXPIRED");
  });
});
