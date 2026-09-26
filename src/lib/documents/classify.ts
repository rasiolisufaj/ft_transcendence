import { ExtractionStatus } from "@/generated/prisma/enums";
import { type CategoryKey } from "@/lib/documents/subtypes";

/**
 * La couture entre l'upload et la classification IA.
 *
 * Cette passe n'appelle aucun modèle : `classifyDocument()` a sa signature
 * définitive et une implémentation qui annonce honnêtement qu'elle n'a rien
 * analysé. Le branchement Anthropic (PROJECT_PLAN B3, `src/lib/ai/extract.ts`)
 * remplacera le corps de cette fonction sans toucher à ses appelants.
 *
 * Note pour ce branchement : la classification relève du minor *image
 * recognition*, pas du major *LLM interface*. §2 du plan tranche qu'elle utilise
 * `messages.parse()` en sortie structurée — **sans streaming**, que §2 réserve à
 * l'assistant.
 */

export type ClassifyInput = {
  /**
   * Les octets du fichier. Volontairement un Buffer et non un `storageKey` :
   * quand E4 sortira les fichiers de `Document.fileData`, les appelants
   * changeront, pas cette signature.
   */
  buffer: Buffer;
  mimeType: string;
  fileName: string;
};

export type Classification = {
  category: CategoryKey;
  /** Brut, tel que proposé. Toujours passé par `narrowSubtypeFields()` avant écriture. */
  subtypeFields: Record<string, unknown>;
  /** 0–1. */
  confidence: number;
  /** `none` tant qu'aucun modèle ne tourne ; `model` une fois B3 branché. */
  source: "none" | "model";
};

/**
 * Seuil sous lequel un humain tranche, plutôt que d'enregistrer une extraction
 * douteuse comme un fait (PROJECT_PLAN B8 : « an extraction below 0.7
 * confidence lands on a review screen »).
 */
export const REVIEW_CONFIDENCE_THRESHOLD = 0.7;

/**
 * Classe un document dans une catégorie du registre.
 *
 * Implémentation actuelle : aucune. Pas d'heuristique sur le nom de fichier non
 * plus — un faux classement coûte plus cher qu'un non-classement assumé, il se
 * voit en démo et il fausse la mesure de précision de B4. Le document part donc
 * dans « Autres » avec `PENDING`, et l'UI le présente comme en attente.
 */
export async function classifyDocument(input: ClassifyInput): Promise<Classification> {
  // Précondition de tout classifieur futur : sans octets, il n'y a rien à lire.
  // La poser ici évite qu'un fichier vide traverse la couture en silence.
  if (input.buffer.length === 0) {
    throw new Error("classifyDocument : fichier vide");
  }
  return { category: "OTHER", subtypeFields: {}, confidence: 0, source: "none" };
}

/**
 * Traduit une classification en état persistable.
 *
 * Distinguer `PENDING` (rien n'a tourné) de `NEEDS_REVIEW` (le modèle a tourné
 * mais doute) est ce qui permettra de mesurer le taux de relecture sans
 * confondre les documents jamais analysés avec les cas douteux.
 */
export function extractionStatusFor(classification: Classification): ExtractionStatus {
  if (classification.source === "none") return ExtractionStatus.PENDING;
  return classification.confidence >= REVIEW_CONFIDENCE_THRESHOLD
    ? ExtractionStatus.CONFIRMED
    : ExtractionStatus.NEEDS_REVIEW;
}
