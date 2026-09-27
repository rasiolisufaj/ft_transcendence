import { ExtractionStatus } from "@/generated/prisma/enums";
import { type CategoryKey } from "@/lib/documents/subtypes";

/**
 * The seam between upload and AI classification.
 *
 * This pass calls no model: `classifyDocument()` has its final signature and an
 * implementation that honestly reports it analysed nothing. Wiring Anthropic
 * (PROJECT_PLAN B3, `src/lib/ai/extract.ts`) will replace the body of this
 * function without touching any of its callers.
 *
 * A note for that wiring: classification belongs to the *image recognition*
 * minor, not the *LLM interface* major. §2 of the plan settles that it uses
 * `messages.parse()` structured output — **no streaming**, which §2 reserves for
 * the assistant.
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
  /** 0–1. */
  confidence: number;
  /** `none` while no model runs; `model` once B3 is wired. */
  source: "none" | "model";
};

/**
 * The threshold below which a human decides, rather than recording a doubtful
 * extraction as fact (PROJECT_PLAN B8: "an extraction below 0.7 confidence lands
 * on a review screen").
 */
export const REVIEW_CONFIDENCE_THRESHOLD = 0.7;

/**
 * Sorts a document into one of the registry's categories.
 *
 * Current implementation: none. No file-name heuristic either — a wrong guess
 * costs more than an admitted non-guess: it shows up in a demo and it skews the
 * accuracy measurement B4 has to produce. So the document goes to "Other" with
 * `PENDING`, and the UI presents it as awaiting classification.
 */
export async function classifyDocument(input: ClassifyInput): Promise<Classification> {
  // A precondition of any future classifier: with no bytes there is nothing to
  // read. Stating it here stops an empty file crossing the seam unnoticed.
  if (input.buffer.length === 0) {
    throw new Error("classifyDocument: empty file");
  }
  return { category: "OTHER", subtypeFields: {}, confidence: 0, source: "none" };
}

/**
 * Turns a classification into a storable state.
 *
 * Separating `PENDING` (nothing ran) from `NEEDS_REVIEW` (the model ran but was
 * unsure) is what will let us measure the review rate without mixing documents
 * that were never analysed in with the genuinely doubtful ones.
 */
export function extractionStatusFor(classification: Classification): ExtractionStatus {
  if (classification.source === "none") return ExtractionStatus.PENDING;
  return classification.confidence >= REVIEW_CONFIDENCE_THRESHOLD
    ? ExtractionStatus.CONFIRMED
    : ExtractionStatus.NEEDS_REVIEW;
}
