import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { DeadlineType } from "@/generated/prisma/enums";
import { EXTRACTION_MODEL, anthropic, hasAnthropicKey } from "@/lib/ai/client";
import {
  CATEGORIES,
  CATEGORY_KEYS,
  classificationHints,
  type CategoryKey,
} from "@/lib/documents/subtypes";

/**
 * The real classification call — PROJECT_PLAN B3.
 *
 * One `messages.parse()` with a Zod-constrained output. No streaming: §2 of the
 * plan reserves streaming for the assistant, and this is a single structured
 * answer, not a conversation.
 *
 * Everything the model is told comes from the registry, so adding a category to
 * `subtypes.ts` extends both the prompt and the output schema with no edit here.
 */

/** Media types we can actually send. The upload action gates on magic bytes too. */
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

export type ExtractionFailure =
  | "NO_KEY"
  | "UNSUPPORTED_TYPE"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "REFUSED"
  | "MALFORMED"
  | "UPSTREAM";

export type ExtractionResult =
  | {
      ok: true;
      category: CategoryKey;
      /** Raw, still to be narrowed by the category's own schema. */
      fields: Record<string, unknown>;
      /** null when the model could not decide. Base-row data, not a subtype field. */
      deadlineType: DeadlineType | null;
      /** ISO date, or null — always null when deadlineType is NONE. */
      targetDate: string | null;
      confidence: number;
      usage: { inputTokens: number; outputTokens: number };
    }
  | { ok: false; reason: ExtractionFailure; message: string };

// ── Output schema, built from the registry ───────────────────────────────────

/**
 * Every subtype field, merged into one object, each one nullable.
 *
 * Nullable-and-required rather than optional: strict structured output wants a
 * closed schema, and "null" is how the model says "not on this document / I
 * cannot read it". Fields belonging to other categories are dropped later by
 * `narrowSubtypeFields()`, which is the single place that decides what may be
 * persisted.
 */
function mergedFieldShape(): z.ZodRawShape {
  // Built as a mutable record: z.ZodRawShape is readonly, so it is the return
  // type, not the accumulator's.
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const key of CATEGORY_KEYS) {
    const { subtype } = CATEGORIES[key];
    if (subtype === null) continue;
    for (const [field, fieldSchema] of Object.entries(subtype.schema.shape)) {
      // Two categories can share a field name (expiryDate): same type, so the
      // first definition wins and the merge stays consistent.
      shape[field] ??= (fieldSchema as z.ZodTypeAny).nullable();
    }
  }
  return shape;
}

/** Exported so a test can assert it tracks the registry. */
export function outputSchema() {
  const [first, ...rest] = CATEGORY_KEYS;
  if (first === undefined) throw new Error("the category registry is empty");

  const deadlines = Object.values(DeadlineType) as [DeadlineType, ...DeadlineType[]];

  return z.object({
    category: z.enum([first, ...rest] as [CategoryKey, ...CategoryKey[]]),
    // Nullable so the model can admit it does not know, rather than picking a
    // deadline type at random to satisfy the schema.
    deadlineType: z.enum(deadlines).nullable(),
    targetDate: z.iso.date().nullable(),
    confidence: z.number().min(0).max(1),
    fields: z.object(mergedFieldShape()),
  });
}

// ── Prompt, built from the registry ──────────────────────────────────────────

/** Exported so a test can assert every category reaches the model. */
export function systemPrompt(): string {
  const categories = classificationHints()
    .map(({ category, hint }) => `- ${category}: ${hint}`)
    .join("\n");

  return [
    "You classify French administrative documents from a photo or a scan.",
    "",
    "Choose exactly one category:",
    categories,
    "",
    "Then read the fields you can see. Rules that matter more than completeness:",
    "- Set a field to null when it is absent, unreadable, or you are not certain.",
    "- Never guess a date, a number or a name. A null is useful; a wrong value is not.",
    "- Dates are ISO calendar dates, YYYY-MM-DD.",
    "- Only fill fields that belong to the category you chose; leave the rest null.",
    "",
    "Then decide how this document's deadline behaves:",
    "- HARD: a legal expiry date. Past it the document is no longer valid",
    "  (ID card, passport, residence permit, roadworthiness test).",
    "- SOFT: a contract that renews itself. Nothing becomes invalid; the risk is",
    "  overpaying (an insurance contract).",
    "- PERIODIC: has to be redone at regular intervals (a declaration).",
    "- NONE: this document has no expiry date at all and never will",
    "  (birth certificate, diploma, payslip, tax notice).",
    "",
    "targetDate is the date that deadline refers to, YYYY-MM-DD:",
    "- HARD: the expiry date printed on the document",
    "- SOFT: the contract anniversary or next renewal date",
    "- PERIODIC: the next date it falls due",
    "- NONE: always null",
    "",
    "One distinction matters more than any other here. Use NONE only when the",
    "document genuinely has no expiry date. If it should have one but you cannot",
    "read it, keep the real deadline type and set targetDate to null instead.",
    "NONE means there is nothing to find; a null date means you did not find it.",
    "",
    "confidence is your own probability that the category is right, from 0 to 1.",
    "Use OTHER with a low confidence rather than forcing a category you doubt.",
  ].join("\n");
}

// ── The call ─────────────────────────────────────────────────────────────────

export async function extractDocument(input: {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
}): Promise<ExtractionResult> {
  if (!hasAnthropicKey()) {
    return { ok: false, reason: "NO_KEY", message: "ANTHROPIC_API_KEY is not set" };
  }

  const isImage = (IMAGE_TYPES as readonly string[]).includes(input.mimeType);
  const isPdf = input.mimeType === "application/pdf";
  if (!isImage && !isPdf) {
    return {
      ok: false,
      reason: "UNSUPPORTED_TYPE",
      message: `cannot send ${input.mimeType} to the model`,
    };
  }

  const data = input.buffer.toString("base64");

  // The file goes before the text block: the model reads the document, then the
  // instruction about what to do with it.
  const content: Anthropic.ContentBlockParam[] = isPdf
    ? [
        {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data },
        },
        { type: "text", text: "Classify this document and read its fields." },
      ]
    : [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: input.mimeType as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
            data,
          },
        },
        { type: "text", text: "Classify this document and read its fields." },
      ];

  try {
    const response = await anthropic().messages.parse({
      model: EXTRACTION_MODEL,
      // Adaptive thinking is on by default on Opus 5 and counts against
      // max_tokens, so this leaves room for it plus the JSON answer.
      max_tokens: 8000,
      output_config: {
        effort: "medium",
        format: zodOutputFormat(outputSchema()),
      },
      system: systemPrompt(),
      messages: [{ role: "user", content }],
    });

    // A safety decline arrives as a 200 with stop_reason "refusal", never as a
    // thrown error — so it has to be checked before reading the output.
    if (response.stop_reason === "refusal") {
      return {
        ok: false,
        reason: "REFUSED",
        message: response.stop_details?.explanation ?? "the model declined the request",
      };
    }

    const parsed = response.parsed_output;
    if (!parsed) {
      return {
        ok: false,
        reason: "MALFORMED",
        message: "the reply did not match the extraction schema",
      };
    }

    // Drop the nulls: "the model said null" and "the field is absent" are the
    // same thing to the narrowing step, and a null would fail a required field
    // with a confusing message.
    const fields = Object.fromEntries(
      Object.entries(parsed.fields).filter(([, value]) => value !== null && value !== undefined),
    );

    return {
      ok: true,
      category: parsed.category,
      fields,
      deadlineType: parsed.deadlineType,
      // NONE and a date together is a contradiction: the type wins, since it is
      // the answer to "can this ever expire" and the date is only its value.
      targetDate: parsed.deadlineType === DeadlineType.NONE ? null : parsed.targetDate,
      confidence: parsed.confidence,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  } catch (error) {
    // Most specific first — a single `catch (APIError)` would lose the
    // difference between "retry later" and "this request is wrong".
    if (error instanceof Anthropic.RateLimitError) {
      return { ok: false, reason: "RATE_LIMITED", message: error.message };
    }
    if (error instanceof Anthropic.APIConnectionTimeoutError) {
      return { ok: false, reason: "TIMEOUT", message: error.message };
    }
    if (error instanceof Anthropic.APIError) {
      return { ok: false, reason: "UPSTREAM", message: `${error.status}: ${error.message}` };
    }
    return {
      ok: false,
      reason: "UPSTREAM",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
