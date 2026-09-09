import type { DeadlineType, ExtractionStatus } from "@/generated/prisma/client";

export type DocumentStatus =
  | "VALID"
  | "EXPIRING_SOON"
  | "EXPIRED"
  | "ACTION_REQUIRED";

const NINETY_DAYS = 90 * 24 * 60 * 60 * 1000;
const SIXTY_DAYS = 60 * 24 * 60 * 60 * 1000;

export function deriveStatus(
  doc: {
    targetDate: Date | null;
    deadlineType: DeadlineType;
    extractionStatus: ExtractionStatus;
  },
  now: Date = new Date(),
): DocumentStatus {
  if (doc.extractionStatus !== "CONFIRMED" || !doc.targetDate) {
    return "ACTION_REQUIRED";
  }

  const msUntil = doc.targetDate.getTime() - now.getTime();

  if (doc.deadlineType === "HARD") {
    if (msUntil < 0) return "EXPIRED";
    if (msUntil < NINETY_DAYS) return "EXPIRING_SOON";
    return "VALID";
  }

  // SOFT: tacit renewal — never expires, nudge 60 days before anniversary
  if (msUntil < SIXTY_DAYS) return "EXPIRING_SOON";
  return "VALID";
}

export const STATUS_COLORS: Record<DocumentStatus, string> = {
  VALID: "bg-emerald-100 text-emerald-800",
  EXPIRING_SOON: "bg-amber-100 text-amber-800",
  EXPIRED: "bg-red-100 text-red-800",
  ACTION_REQUIRED: "bg-blue-100 text-blue-800",
};

export const STATUS_LABELS: Record<DocumentStatus, string> = {
  VALID: "Valid",
  EXPIRING_SOON: "Expiring Soon",
  EXPIRED: "Expired",
  ACTION_REQUIRED: "Action Required",
};
