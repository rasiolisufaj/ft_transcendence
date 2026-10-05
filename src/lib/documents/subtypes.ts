import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { DocumentCategory } from "@/generated/prisma/enums";

/**
 * The document category registry — the single source of truth.
 *
 * Three things are derived from it, which is what makes adding a category cheap
 * (PROJECT_PLAN §4: "Adding a document category touches this file and nothing
 * else"):
 *
 *   - the dashboard cards          → `categoryCards()`
 *   - the AI classification prompt → `classificationHints()`
 *   - writing the typed row        → `narrowSubtypeFields()`
 *
 * To add a category: one value in the Prisma `DocumentCategory` enum, its
 * `Document<Name>` table if it has fields of its own, and one entry here. The
 * `satisfies Record<DocumentCategory, …>` below fails the build if either is
 * missing.
 */

// ── Subtype schemas ──────────────────────────────────────────────────────────
// One schema per category, imported both by the AI narrowing and (later, E8) by
// the edit form — never two schemas that "look the same", which §0 of the plan
// calls a defect rather than an implementation.

export const IdentitySchema = z.object({
  fullName: z.string().min(1),
  birthDate: z.iso.date(),
  documentNumber: z.string().min(1),
  expiryDate: z.iso.date(),
});

export const InsuranceAutoSchema = z.object({
  provider: z.string().min(1),
  policyNumber: z.string().min(1),
  vehiclePlate: z.string().min(1),
  expiryDate: z.iso.date(),
});

// ── Registry types ───────────────────────────────────────────────────────────

/** The Prisma delegate name, as we call it: `prisma[model].create(…)`. */
export type SubtypeModel = "documentIdentity" | "documentInsuranceAuto";

export type SubtypeDef = {
  model: SubtypeModel;
  schema: z.ZodObject<z.ZodRawShape>;
};

export type CategoryDef = {
  /**
   * URL segment, kept stable: /fr/documents/<slug>. Doubles as the i18n key:
   * the card title and the description live in `categories.<slug>` in
   * messages/*.json, never here — this registry holds no display text.
   */
  slug: string;
  /** null = no typed table. Only the case for OTHER (PROJECT_PLAN §3). */
  subtype: SubtypeDef | null;
  /**
   * Injected into the classification prompt. Describes what belongs here.
   * Stays English on purpose: it is read by the model, not by the user.
   */
  aiHint: string;
};

// ── The registry ─────────────────────────────────────────────────────────────

export const CATEGORIES = {
  IDENTITY: {
    slug: "identity",
    subtype: { model: "documentIdentity", schema: IdentitySchema },
    aiHint:
      "national ID card, passport, residence permit, driving licence — " +
      "an official document that identifies a person and carries an expiry date",
  },
  INSURANCE_AUTO: {
    slug: "insurance",
    subtype: { model: "documentInsuranceAuto", schema: InsuranceAutoSchema },
    aiHint:
      "car insurance certificate, green card, contract or renewal notice from an " +
      "insurer — carries a policy number and an insured vehicle",
  },
  OTHER: {
    slug: "other",
    // No typed table: this is the catch-all, and a document the AI could not
    // classify lands here with extractionStatus = PENDING / NEEDS_REVIEW.
    subtype: null,
    aiHint:
      "any document that clearly belongs to none of the categories above — " +
      "pick it only as a fallback, never to settle a doubt between two categories",
  },
} as const satisfies Record<DocumentCategory, CategoryDef>;

export type CategoryKey = keyof typeof CATEGORIES;

/**
 * The slugs as literals, so `t(`${slug}.label`)` is checked against the message
 * catalogue: a category whose translations are missing fails the typecheck.
 */
export type CategorySlug = (typeof CATEGORIES)[CategoryKey]["slug"];

export const CATEGORY_KEYS = Object.keys(CATEGORIES) as readonly CategoryKey[];

// ── URL resolution ───────────────────────────────────────────────────────────

/** The slug comes from the URL, so from the user: never a cast, always a lookup. */
export function categoryFromSlug(slug: string): CategoryKey | null {
  for (const key of CATEGORY_KEYS) {
    if (CATEGORIES[key].slug === slug) return key;
  }
  return null;
}

// ── Derived views ────────────────────────────────────────────────────────────

export type CategoryCard = {
  category: CategoryKey;
  /** Also the i18n key: the dashboard reads `categories.<slug>.label`. */
  slug: CategorySlug;
  href: string;
};

/**
 * The dashboard cards. Derived from the registry, never hand-maintained: a new
 * category gets its card without anyone touching the dashboard.
 *
 * `href` is locale-relative on purpose: the registry knows nothing about
 * routing, and the `Link` from `@/i18n/navigation` prepends the active locale.
 * Baking `/<locale>` in here would prefix it twice (/fr/fr/documents/…).
 */
export function categoryCards(): CategoryCard[] {
  return CATEGORY_KEYS.map((category) => {
    const def = CATEGORIES[category];
    return {
      category,
      slug: def.slug,
      href: `/documents/${def.slug}`,
    };
  });
}

export type ClassificationHint = { category: CategoryKey; hint: string };

/** The categories as we will present them to the model. See `classify.ts`. */
export function classificationHints(): ClassificationHint[] {
  return CATEGORY_KEYS.map((category) => ({
    category,
    hint: CATEGORIES[category].aiHint,
  }));
}

// ── Narrowing before a write ─────────────────────────────────────────────────

export type NarrowResult =
  | {
      ok: true;
      /** null for OTHER: nothing to write into a typed table. */
      model: SubtypeModel | null;
      data: Record<string, unknown> | null;
    }
  | {
      ok: false;
      issues: { path: readonly PropertyKey[]; message: string }[];
    };

/**
 * Runs `fields` through the category's schema before any write.
 *
 * PROJECT_PLAN B3: "A field the schema doesn't know is dropped, never persisted
 * into the base metadata." Stripping unknown keys is Zod's default on an object
 * schema — that is what protects the database from a field the model made up.
 */
export function narrowSubtypeFields(category: CategoryKey, fields: unknown): NarrowResult {
  const { subtype } = CATEGORIES[category];
  if (subtype === null) return { ok: true, model: null, data: null };

  const parsed = subtype.schema.safeParse(fields);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((issue) => ({
        path: [...issue.path],
        message: issue.message,
      })),
    };
  }

  // The schema is generic here (ZodRawShape), so its output is too. The keys are
  // the schema's own; precise narrowing happens at write time, where the typed
  // Prisma delegate takes over.
  return { ok: true, model: subtype.model, data: parsed.data as Record<string, unknown> };
}

// ── Writing the typed row ────────────────────────────────────────────────────

/**
 * Writes the subtype row for a classified document.
 *
 * The `switch` lives here, in the registry, on purpose: it is the one place that
 * has to grow when a category is added, so the promise that adding a category
 * touches a single file still holds.
 *
 * Each branch re-parses through its own schema rather than casting. It costs a
 * few microseconds and buys real type safety on the Prisma call — a field that
 * drifted between the schema and the table fails here, not in Postgres.
 *
 * Dates are converted here rather than in the schemas: the schemas are also fed
 * to `zodOutputFormat()` to build the model's JSON schema, and a `.transform()`
 * in them would complicate that generation for no gain.
 */
export async function writeSubtypeRow(
  tx: Prisma.TransactionClient,
  model: SubtypeModel,
  documentId: number,
  data: Record<string, unknown>,
): Promise<void> {
  switch (model) {
    case "documentIdentity": {
      const d = IdentitySchema.parse(data);
      await tx.documentIdentity.create({
        data: {
          documentId,
          fullName: d.fullName,
          birthDate: new Date(`${d.birthDate}T00:00:00Z`),
          documentNumber: d.documentNumber,
          expiryDate: new Date(`${d.expiryDate}T00:00:00Z`),
        },
      });
      return;
    }
    case "documentInsuranceAuto": {
      const d = InsuranceAutoSchema.parse(data);
      await tx.documentInsuranceAuto.create({
        data: {
          documentId,
          provider: d.provider,
          policyNumber: d.policyNumber,
          vehiclePlate: d.vehiclePlate,
          expiryDate: new Date(`${d.expiryDate}T00:00:00Z`),
        },
      });
      return;
    }
  }
}
