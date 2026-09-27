import { DeadlineType, ExtractionStatus } from "@/generated/prisma/enums";
import { extractDocument, type ExtractionFailure } from "@/lib/ai/extract";
import { type CategoryKey } from "@/lib/documents/subtypes";

/**
 * The seam between the upload and the AI classification.
 *
 * The upload action calls only this. `src/lib/ai/extract.ts` owns the model call
 * (PROJECT_PLAN B3); this module owns the translation into something the database
 * can store. Keeping the two apart is what let the dashboard ship before the AI
 * existed, and it is what will let the model swap out without touching upload.
 *
 * Classification serves the *image recognition* minor, not the *LLM interface*
 * major — §2 of the plan settles that it uses structured output, not streaming.
 */

export type ClassifyInput = {
  /**
   * The file bytes. Deliberately a Buffer rather than a `storageKey`: when E4
   * moves files out of `Document.fileData`, the callers change, this signature
   * does not.
   */
  buffer: Buffer;
  mimeType: string;
  fileName: string;
};

export type Classification = {
  category: CategoryKey;
  /** Raw, as proposed. Always passed through `narrowSubtypeFields()` before a write. */
  subtypeFields: Record<string, unknown>;
  /** null when nothing usable ran, or when the model could not decide. */
  deadlineType: DeadlineType | null;
  /** ISO date, or null. Always null when deadlineType is NONE. */
  targetDate: string | null;
  /** 0–1. */
  confidence: number;
  source: "model" | "failed";
  /** Set only when `source` is "failed". */
  failure?: ExtractionFailure;
  usage?: { inputTokens: number; outputTokens: number };
};

/**
 * The threshold below which a human decides, rather than recording a doubtful
 * extraction as fact (PROJECT_PLAN B8: "an extraction below 0.7 confidence lands
 * on a review screen").
 */
export const REVIEW_CONFIDENCE_THRESHOLD = 0.7;

/**
 * Failures that will not fix themselves. A refusal, a reply that does not match
 * the schema, or a media type we cannot send will fail again on every retry, so
 * the document is marked FAILED and stops costing money.
 *
 * Everything else — no key, a 429, a timeout, a 5xx — is worth retrying, so the
 * document stays PENDING and looks exactly like one not yet analysed.
 */
const TERMINAL_FAILURES: readonly ExtractionFailure[] = [
  "REFUSED",
  "MALFORMED",
  "UNSUPPORTED_TYPE",
];

/** Sorts a document into one of the registry's categories. */
export async function classifyDocument(input: ClassifyInput): Promise<Classification> {
  // A precondition of any classifier: with no bytes there is nothing to read.
  if (input.buffer.length === 0) {
    throw new Error("classifyDocument: empty file");
  }

  const result = await extractDocument(input);

  if (!result.ok) {
    // A failed classification is never a guessed category: the document goes to
    // OTHER with a zero confidence, and its status says why a human should look.
    return {
      category: "OTHER",
      subtypeFields: {},
      deadlineType: null,
      targetDate: null,
      confidence: 0,
      source: "failed",
      failure: result.reason,
    };
  }

  return {
    category: result.category,
    subtypeFields: result.fields,
    deadlineType: result.deadlineType,
    targetDate: result.targetDate,
    confidence: result.confidence,
    source: "model",
    usage: result.usage,
  };
}

/**
 * Translates a classification into a storable state.
 *
 * Keeping `PENDING` (nothing usable ran) apart from `NEEDS_REVIEW` (the model ran
 * and doubted) is what lets us measure the review rate later without mixing the
 * two populations.
 */
export function extractionStatusFor(classification: Classification): ExtractionStatus {
  if (classification.source === "failed") {
    return classification.failure && TERMINAL_FAILURES.includes(classification.failure)
      ? ExtractionStatus.FAILED
      : ExtractionStatus.PENDING;
  }
  return classification.confidence >= REVIEW_CONFIDENCE_THRESHOLD
    ? ExtractionStatus.CONFIRMED
    : ExtractionStatus.NEEDS_REVIEW;
}
