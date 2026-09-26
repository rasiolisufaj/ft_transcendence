import { z } from "zod";
import { DocumentCategory } from "@/generated/prisma/enums";

/**
 * Le registre des catégories de documents — la source unique.
 *
 * Trois choses en dérivent, et c'est ce qui rend l'ajout d'une catégorie bon
 * marché (PROJECT_PLAN §4 : « Adding a document category touches this file and
 * nothing else ») :
 *
 *   - les cartes du dashboard        → `categoryCards()`
 *   - le prompt de classification IA → `classificationHints()`
 *   - l'écriture de la ligne typée   → `narrowSubtypeFields()`
 *
 * Pour ajouter une catégorie : une valeur dans l'enum Prisma `DocumentCategory`,
 * sa table `Document<Nom>` si elle a des champs propres, et une entrée ici. Le
 * `satisfies Record<DocumentCategory, …>` plus bas fait échouer la compilation
 * si l'un des deux manque.
 */

// ── Schémas des sous-types ───────────────────────────────────────────────────
// Un seul schéma par catégorie, importé à la fois par le narrowing de l'IA et
// (plus tard, E8) par le formulaire d'édition — jamais deux schémas « qui se
// ressemblent », ce que §0 du plan qualifie de défaut.

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

// ── Types du registre ────────────────────────────────────────────────────────

/** Nom du délégué Prisma, tel qu'on l'appelle : `prisma[model].create(…)`. */
export type SubtypeModel = "documentIdentity" | "documentInsuranceAuto";

export type SubtypeDef = {
  model: SubtypeModel;
  schema: z.ZodObject<z.ZodRawShape>;
};

export type CategoryDef = {
  /** Segment d'URL, stable : /fr/documents/<slug>. */
  slug: string;
  /** Libellé de la carte. Deviendra une clé i18n quand D10 livrera next-intl. */
  label: string;
  description: string;
  /** null = pas de table typée. Seul le cas de OTHER (PROJECT_PLAN §3). */
  subtype: SubtypeDef | null;
  /** Injecté dans le prompt de classification. Décrit ce qui tombe ici. */
  aiHint: string;
};

// ── Le registre ──────────────────────────────────────────────────────────────

export const CATEGORIES = {
  IDENTITY: {
    slug: "identite",
    label: "Mes pièces d'identité",
    description: "CNI, passeport, titre de séjour, permis de conduire",
    subtype: { model: "documentIdentity", schema: IdentitySchema },
    aiHint:
      "carte nationale d'identité, passeport, titre de séjour, permis de conduire — " +
      "un document officiel qui identifie une personne et porte une date d'expiration",
  },
  INSURANCE_AUTO: {
    slug: "assurances",
    label: "Mes assurances",
    description: "Attestations et contrats d'assurance",
    subtype: { model: "documentInsuranceAuto", schema: InsuranceAutoSchema },
    aiHint:
      "attestation d'assurance automobile, carte verte, contrat ou avis d'échéance " +
      "d'un assureur — porte un numéro de police et un véhicule assuré",
  },
  OTHER: {
    slug: "autres",
    label: "Autres",
    description: "Documents non classés",
    // Pas de table typée : c'est le fourre-tout, et un document que l'IA n'a pas
    // su classer atterrit ici avec extractionStatus = PENDING / NEEDS_REVIEW.
    subtype: null,
    aiHint:
      "tout document qui ne relève clairement d'aucune catégorie ci-dessus — " +
      "à ne choisir que par défaut, jamais pour trancher un doute entre deux catégories",
  },
} as const satisfies Record<DocumentCategory, CategoryDef>;

export type CategoryKey = keyof typeof CATEGORIES;

export const CATEGORY_KEYS = Object.keys(CATEGORIES) as readonly CategoryKey[];

// ── Résolution d'URL ─────────────────────────────────────────────────────────

/** Le slug vient de l'URL, donc de l'utilisateur : jamais de cast, une recherche. */
export function categoryFromSlug(slug: string): CategoryKey | null {
  for (const key of CATEGORY_KEYS) {
    if (CATEGORIES[key].slug === slug) return key;
  }
  return null;
}

// ── Vues dérivées ────────────────────────────────────────────────────────────

export type CategoryCard = {
  category: CategoryKey;
  slug: string;
  label: string;
  description: string;
  href: string;
};

/**
 * Les cartes du dashboard. Dérivées du registre, jamais maintenues à la main :
 * une nouvelle catégorie obtient sa carte sans qu'on touche au dashboard.
 *
 * `locale` est optionnel pour que le registre reste testable sans connaître le
 * routage ; les pages passent la locale du segment.
 */
export function categoryCards(locale?: string): CategoryCard[] {
  const prefix = locale ? `/${locale}` : "";
  return CATEGORY_KEYS.map((category) => {
    const def = CATEGORIES[category];
    return {
      category,
      slug: def.slug,
      label: def.label,
      description: def.description,
      href: `${prefix}/documents/${def.slug}`,
    };
  });
}

export type ClassificationHint = { category: CategoryKey; hint: string };

/** Les catégories telles qu'on les présentera au modèle. Voir `classify.ts`. */
export function classificationHints(): ClassificationHint[] {
  return CATEGORY_KEYS.map((category) => ({
    category,
    hint: CATEGORIES[category].aiHint,
  }));
}

// ── Narrowing avant écriture ─────────────────────────────────────────────────

export type NarrowResult =
  | {
      ok: true;
      /** null pour OTHER : rien à écrire dans une table typée. */
      model: SubtypeModel | null;
      data: Record<string, unknown> | null;
    }
  | {
      ok: false;
      issues: { path: readonly PropertyKey[]; message: string }[];
    };

/**
 * Passe `fields` au crible du schéma de la catégorie avant toute écriture.
 *
 * PROJECT_PLAN B3 : « A field the schema doesn't know is dropped, never
 * persisted into the base metadata. » Le strip des clés inconnues est le
 * comportement par défaut de Zod sur un objet — c'est ce qui protège la base
 * d'un champ halluciné par le modèle.
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

  // Le schéma est générique ici (ZodRawShape), donc sa sortie l'est aussi. Les
  // clés sont celles du schéma : le narrowing précis se fait à l'écriture, où le
  // délégué Prisma typé reprend la main.
  return { ok: true, model: subtype.model, data: parsed.data as Record<string, unknown> };
}
