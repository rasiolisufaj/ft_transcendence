import { describe, expect, it } from "vitest";
import { ExtractionStatus } from "@/generated/prisma/enums";
import {
  REVIEW_CONFIDENCE_THRESHOLD,
  classifyDocument,
  extractionStatusFor,
} from "@/lib/documents/classify";
import { CATEGORY_KEYS, narrowSubtypeFields } from "@/lib/documents/subtypes";

const pdf = {
  buffer: Buffer.from("%PDF-1.4 fake"),
  mimeType: "application/pdf",
  fileName: "document.pdf",
};

describe("classifyDocument", () => {
  it("returns a category the registry knows", async () => {
    const result = await classifyDocument(pdf);
    expect(CATEGORY_KEYS).toContain(result.category);
  });

  it("returns a confidence between 0 and 1", async () => {
    const result = await classifyDocument(pdf);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it("returns subtype fields the registry can narrow", async () => {
    const result = await classifyDocument(pdf);
    expect(() => narrowSubtypeFields(result.category, result.subtypeFields)).not.toThrow();
  });

  // While no model runs, the seam must SAY so rather than guess. A wrong guess
  // shows up in a demo and skews the accuracy measurement B4 has to produce.
  it("reports that no model has run yet", async () => {
    const result = await classifyDocument(pdf);
    expect(result.source).toBe("none");
    expect(result.category).toBe("OTHER");
    expect(result.confidence).toBe(0);
  });

  // Deliberate choice: no file-name heuristic. This test exists so that we only
  // break it knowingly, the day we decide we want one.
  it("does not guess from the file name", async () => {
    const guessable = await classifyDocument({ ...pdf, fileName: "passeport-adrien-2031.pdf" });
    expect(guessable.category).toBe("OTHER");
    expect(guessable.source).toBe("none");
  });

  // With no bytes there is nothing to classify: better to fail loudly than let
  // an empty file cross the seam and come out as "Other".
  it("rejects an empty buffer", async () => {
    await expect(classifyDocument({ ...pdf, buffer: Buffer.alloc(0) })).rejects.toThrow(
      /empty/,
    );
  });

  it("is deterministic", async () => {
    const a = await classifyDocument(pdf);
    const b = await classifyDocument(pdf);
    expect(a).toEqual(b);
  });
});

describe("extractionStatusFor", () => {
  it("is PENDING while no model has run", () => {
    expect(
      extractionStatusFor({ category: "OTHER", subtypeFields: {}, confidence: 0, source: "none" }),
    ).toBe(ExtractionStatus.PENDING);
  });

  it("is CONFIRMED at or above the review threshold", () => {
    expect(
      extractionStatusFor({
        category: "IDENTITY",
        subtypeFields: {},
        confidence: REVIEW_CONFIDENCE_THRESHOLD,
        source: "model",
      }),
    ).toBe(ExtractionStatus.CONFIRMED);
  });

  // PROJECT_PLAN B8: below 0.7, a human decides on a review screen.
  it("is NEEDS_REVIEW below the review threshold", () => {
    expect(
      extractionStatusFor({
        category: "IDENTITY",
        subtypeFields: {},
        confidence: REVIEW_CONFIDENCE_THRESHOLD - 0.01,
        source: "model",
      }),
    ).toBe(ExtractionStatus.NEEDS_REVIEW);
  });

  it("keeps the threshold in the range the model can produce", () => {
    expect(REVIEW_CONFIDENCE_THRESHOLD).toBeGreaterThan(0);
    expect(REVIEW_CONFIDENCE_THRESHOLD).toBeLessThanOrEqual(1);
  });
});
