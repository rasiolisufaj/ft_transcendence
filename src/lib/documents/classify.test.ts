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

  // Tant qu'aucun modèle ne tourne, la couture doit le DIRE plutôt que de
  // deviner. Un faux classement se voit en démo et fausse la mesure de
  // précision que B4 devra produire.
  it("reports that no model has run yet", async () => {
    const result = await classifyDocument(pdf);
    expect(result.source).toBe("none");
    expect(result.category).toBe("OTHER");
    expect(result.confidence).toBe(0);
  });

  // Choix délibéré : pas d'heuristique sur le nom de fichier. Ce test est là
  // pour qu'on le casse sciemment le jour où on en voudrait une.
  it("does not guess from the file name", async () => {
    const guessable = await classifyDocument({ ...pdf, fileName: "passeport-adrien-2031.pdf" });
    expect(guessable.category).toBe("OTHER");
    expect(guessable.source).toBe("none");
  });

  // Sans octets il n'y a rien à classer : mieux vaut échouer fort que laisser
  // un fichier vide traverser la couture et ressortir en « Autres ».
  it("rejects an empty buffer", async () => {
    await expect(classifyDocument({ ...pdf, buffer: Buffer.alloc(0) })).rejects.toThrow(
      /vide/,
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

  // PROJECT_PLAN B8 : sous 0.7, un humain tranche sur un écran de relecture.
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
