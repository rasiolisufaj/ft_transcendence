import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExtractionStatus } from "@/generated/prisma/enums";
import { CATEGORY_KEYS, narrowSubtypeFields } from "@/lib/documents/subtypes";

// The model call is mocked: this file tests the translation from a model answer
// into a storable state, never the API. PROJECT_PLAN: no live calls in tests.
const extractDocument = vi.fn();
vi.mock("@/lib/ai/extract", () => ({ extractDocument }));

const { REVIEW_CONFIDENCE_THRESHOLD, classifyDocument, extractionStatusFor } = await import(
  "@/lib/documents/classify"
);

const pdf = {
  buffer: Buffer.from("%PDF-1.4 fake"),
  mimeType: "application/pdf",
  fileName: "document.pdf",
};

const identityFields = {
  fullName: "Adrien Regis",
  birthDate: "1998-04-12",
  documentNumber: "19AB45678",
  expiryDate: "2031-04-11",
};

beforeEach(() => extractDocument.mockReset());

describe("classifyDocument", () => {
  it("passes a confident extraction straight through", async () => {
    extractDocument.mockResolvedValue({
      ok: true,
      category: "IDENTITY",
      fields: identityFields,
      deadlineType: "HARD",
      targetDate: "2031-04-11",
      confidence: 0.94,
      usage: { inputTokens: 1800, outputTokens: 120 },
    });

    const result = await classifyDocument(pdf);
    expect(result.category).toBe("IDENTITY");
    expect(result.confidence).toBe(0.94);
    expect(result.source).toBe("model");
    expect(result.usage).toEqual({ inputTokens: 1800, outputTokens: 120 });
  });

  it("passes the deadline through untouched", async () => {
    extractDocument.mockResolvedValue({
      ok: true,
      category: "IDENTITY",
      fields: identityFields,
      deadlineType: "HARD",
      targetDate: "2031-04-11",
      confidence: 0.9,
      usage: { inputTokens: 1, outputTokens: 1 },
    });
    const result = await classifyDocument(pdf);
    expect(result.deadlineType).toBe("HARD");
    expect(result.targetDate).toBe("2031-04-11");
  });

  // A document with no expiry is not a failure: NONE plus a null date is a
  // complete, correct answer, and deriveStatus must read it as VALID.
  it("keeps NONE with a null date as a valid answer", async () => {
    extractDocument.mockResolvedValue({
      ok: true,
      category: "OTHER",
      fields: {},
      deadlineType: "NONE",
      targetDate: null,
      confidence: 0.88,
      usage: { inputTokens: 1, outputTokens: 1 },
    });
    const result = await classifyDocument(pdf);
    expect(result.deadlineType).toBe("NONE");
    expect(result.targetDate).toBeNull();
    expect(result.source).toBe("model");
  });

  it("returns a category the registry knows", async () => {
    extractDocument.mockResolvedValue({
      ok: true,
      category: "INSURANCE_AUTO",
      fields: {},
      deadlineType: "SOFT",
      targetDate: "2027-01-31",
      confidence: 0.5,
      usage: { inputTokens: 1, outputTokens: 1 },
    });
    const result = await classifyDocument(pdf);
    expect(CATEGORY_KEYS).toContain(result.category);
  });

  it("returns fields the registry can narrow", async () => {
    extractDocument.mockResolvedValue({
      ok: true,
      category: "IDENTITY",
      fields: identityFields,
      deadlineType: "HARD",
      targetDate: "2031-04-11",
      confidence: 0.9,
      usage: { inputTokens: 1, outputTokens: 1 },
    });
    const result = await classifyDocument(pdf);
    expect(narrowSubtypeFields(result.category, result.subtypeFields).ok).toBe(true);
  });

  // A failure must never look like a classification decision. Guessing a
  // category here would poison the accuracy numbers B4 has to produce.
  it("never guesses a category when the call fails", async () => {
    extractDocument.mockResolvedValue({ ok: false, reason: "UPSTREAM", message: "500" });
    const result = await classifyDocument(pdf);
    expect(result.category).toBe("OTHER");
    expect(result.confidence).toBe(0);
    expect(result.source).toBe("failed");
    expect(result.failure).toBe("UPSTREAM");
    expect(result.subtypeFields).toEqual({});
    expect(result.deadlineType).toBeNull();
    expect(result.targetDate).toBeNull();
  });

  it("rejects an empty buffer before calling the model", async () => {
    await expect(classifyDocument({ ...pdf, buffer: Buffer.alloc(0) })).rejects.toThrow(/empty/);
    expect(extractDocument).not.toHaveBeenCalled();
  });
});

describe("extractionStatusFor", () => {
  const modelAnswer = (confidence: number) => ({
    category: "IDENTITY" as const,
    subtypeFields: {},
    deadlineType: "HARD" as const,
    targetDate: "2031-04-11",
    confidence,
    source: "model" as const,
  });

  it("is CONFIRMED at or above the review threshold", () => {
    expect(extractionStatusFor(modelAnswer(REVIEW_CONFIDENCE_THRESHOLD))).toBe(
      ExtractionStatus.CONFIRMED,
    );
    expect(extractionStatusFor(modelAnswer(1))).toBe(ExtractionStatus.CONFIRMED);
  });

  // PROJECT_PLAN B8: below 0.7, a human decides on a review screen.
  it("is NEEDS_REVIEW below the review threshold", () => {
    expect(extractionStatusFor(modelAnswer(REVIEW_CONFIDENCE_THRESHOLD - 0.01))).toBe(
      ExtractionStatus.NEEDS_REVIEW,
    );
  });

  // Retryable failures leave the document indistinguishable from one not yet
  // analysed, so a later retry picks it up naturally.
  it.each(["NO_KEY", "RATE_LIMITED", "TIMEOUT", "UPSTREAM"] as const)(
    "is PENDING for the retryable failure %s",
    (failure) => {
      expect(
        extractionStatusFor({
          category: "OTHER",
          subtypeFields: {},
          deadlineType: null,
          targetDate: null,
          confidence: 0,
          source: "failed",
          failure,
        }),
      ).toBe(ExtractionStatus.PENDING);
    },
  );

  // Terminal failures fail again every time, so they stop costing money.
  it.each(["REFUSED", "MALFORMED", "UNSUPPORTED_TYPE"] as const)(
    "is FAILED for the terminal failure %s",
    (failure) => {
      expect(
        extractionStatusFor({
          category: "OTHER",
          subtypeFields: {},
          deadlineType: null,
          targetDate: null,
          confidence: 0,
          source: "failed",
          failure,
        }),
      ).toBe(ExtractionStatus.FAILED);
    },
  );

  it("keeps the threshold in the range the model can produce", () => {
    expect(REVIEW_CONFIDENCE_THRESHOLD).toBeGreaterThan(0);
    expect(REVIEW_CONFIDENCE_THRESHOLD).toBeLessThanOrEqual(1);
  });
});
