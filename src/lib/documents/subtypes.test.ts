import { describe, expect, it } from "vitest";
import { DocumentCategory } from "@/generated/prisma/enums";
import {
  CATEGORIES,
  CATEGORY_KEYS,
  categoryFromSlug,
  categoryCards,
  classificationHints,
  narrowSubtypeFields,
  type CategoryKey,
} from "@/lib/documents/subtypes";

describe("the category registry", () => {
  it("assigns every category a unique slug", () => {
    const slugs = CATEGORY_KEYS.map((key) => CATEGORIES[key].slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("uses URL-safe slugs", () => {
    for (const key of CATEGORY_KEYS) {
      expect(CATEGORIES[key].slug).toMatch(/^[a-z0-9-]+$/);
    }
  });

  // The registry and the Prisma enum must agree in BOTH directions: a category
  // the database accepts but the registry ignores would render no card, and a
  // registry-only category would fail on write.
  it("covers exactly the Prisma DocumentCategory enum", () => {
    expect([...CATEGORY_KEYS].sort()).toEqual(Object.values(DocumentCategory).sort());
  });

  it("gives every category a non-empty label, description and AI hint", () => {
    for (const key of CATEGORY_KEYS) {
      const def = CATEGORIES[key];
      expect(def.label.length).toBeGreaterThan(0);
      expect(def.description.length).toBeGreaterThan(0);
      expect(def.aiHint.length).toBeGreaterThan(0);
    }
  });

  it("pairs a Prisma model with a schema whenever a subtype table exists", () => {
    for (const key of CATEGORY_KEYS) {
      const { subtype } = CATEGORIES[key];
      if (subtype === null) continue;
      expect(subtype.model.length).toBeGreaterThan(0);
      expect(subtype.schema).toBeDefined();
    }
  });

  // PROJECT_PLAN §3: `metadata Json?` on the base row exists only for OTHER —
  // it is the catch-all, so it deliberately has no typed table.
  it("leaves OTHER without a subtype table", () => {
    expect(CATEGORIES.OTHER.subtype).toBeNull();
  });
});

describe("categoryFromSlug", () => {
  it("round-trips every category", () => {
    for (const key of CATEGORY_KEYS) {
      expect(categoryFromSlug(CATEGORIES[key].slug)).toBe(key);
    }
  });

  it("returns null for an unknown slug", () => {
    expect(categoryFromSlug("pas-une-categorie")).toBeNull();
    expect(categoryFromSlug("")).toBeNull();
  });
});

// These two are what make adding a category cheap: the dashboard cards and the
// classification prompt are derived from the registry, never hand-maintained.
// A new entry in CATEGORIES has to show up in both without further edits.
describe("registry-derived views", () => {
  it("produces one dashboard card per category", () => {
    const cards = categoryCards();
    expect(cards).toHaveLength(CATEGORY_KEYS.length);
    for (const card of cards) {
      expect(CATEGORY_KEYS).toContain(card.category);
      expect(card.href).toContain(CATEGORIES[card.category].slug);
    }
  });

  it("produces one classification hint per category", () => {
    const hints = classificationHints();
    expect(hints).toHaveLength(CATEGORY_KEYS.length);
    for (const key of CATEGORY_KEYS) {
      expect(hints.some((h) => h.category === key && h.hint === CATEGORIES[key].aiHint)).toBe(true);
    }
  });
});

describe("narrowSubtypeFields", () => {
  const validIdentity = {
    fullName: "Adrien Regis",
    birthDate: "1998-04-12",
    documentNumber: "19AB45678",
    expiryDate: "2031-04-11",
  };

  it("accepts a well-formed subtype payload", () => {
    const result = narrowSubtypeFields("IDENTITY", validIdentity);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.model).toBe("documentIdentity");
      expect(result.data).toEqual(validIdentity);
    }
  });

  // PROJECT_PLAN B3: "A field the schema doesn't know is dropped, never
  // persisted into the base metadata."
  it("drops fields the schema does not know", () => {
    const result = narrowSubtypeFields("IDENTITY", {
      ...validIdentity,
      hallucinatedByTheModel: "should never reach the database",
      nested: { alsoDropped: true },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual(validIdentity);
      expect(result.data).not.toHaveProperty("hallucinatedByTheModel");
      expect(result.data).not.toHaveProperty("nested");
    }
  });

  it("rejects a payload missing a required field", () => {
    const incomplete = {
      fullName: validIdentity.fullName,
      documentNumber: validIdentity.documentNumber,
      expiryDate: validIdentity.expiryDate,
    };
    const result = narrowSubtypeFields("IDENTITY", incomplete);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.path.includes("birthDate"))).toBe(true);
    }
  });

  it("rejects a malformed date", () => {
    const result = narrowSubtypeFields("IDENTITY", {
      ...validIdentity,
      expiryDate: "11/04/2031",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a payload that is not an object", () => {
    expect(narrowSubtypeFields("IDENTITY", null).ok).toBe(false);
    expect(narrowSubtypeFields("IDENTITY", "carte d'identité").ok).toBe(false);
  });

  it("narrows the insurance subtype against its own schema", () => {
    const result = narrowSubtypeFields("INSURANCE_AUTO", {
      provider: "MAIF",
      policyNumber: "P-4419023",
      vehiclePlate: "AB-123-CD",
      expiryDate: "2027-01-31",
      premium: 512,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.model).toBe("documentInsuranceAuto");
      expect(result.data).not.toHaveProperty("premium");
    }
  });

  // OTHER has no table, so there is nothing to write and nothing to validate —
  // but the call must still succeed, otherwise every unclassified upload fails.
  it("succeeds with no model and no data for OTHER", () => {
    const result = narrowSubtypeFields("OTHER", { anything: true });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.model).toBeNull();
      expect(result.data).toBeNull();
    }
  });

  it("handles every category without throwing", () => {
    for (const key of CATEGORY_KEYS satisfies readonly CategoryKey[]) {
      expect(() => narrowSubtypeFields(key, {})).not.toThrow();
    }
  });
});
