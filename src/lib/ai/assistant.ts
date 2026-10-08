import Anthropic from "@anthropic-ai/sdk";
import { EXTRACTION_MODEL, anthropic, hasAnthropicKey } from "@/lib/ai/client";

const ASSISTANT_MODEL = EXTRACTION_MODEL;
const MAX_MESSAGES_PER_HOUR = 30;
const MAX_HISTORY_MESSAGES = 20;

export type AssistantChunk =
  | { type: "token"; text: string }
  | { type: "done"; usage: { inputTokens: number; outputTokens: number } }
  | { type: "error"; code: AssistantErrorCode; messageKey: string };

export type AssistantErrorCode =
  | "NO_KEY"
  | "RATE_LIMITED"
  | "UPSTREAM"
  | "REFUSED";

export type HistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AssistantRequest = {
  userId: string;
  locale: string;
  question: string;
  history: HistoryMessage[];
  document: {
    fileName: string;
    fileType: string;
    fileData: Buffer;
    category: string;
    targetDate: Date | null;
    deadlineType: string | null;
    extractionStatus: string;
  };
};

// ── Per-user rate limiting (in-memory, like login) ──────────────────────────

const usage = new Map<string, number[]>();

function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const hourAgo = now - 3_600_000;
  const timestamps = (usage.get(userId) ?? []).filter((t) => t > hourAgo);
  usage.set(userId, timestamps);
  return timestamps.length >= MAX_MESSAGES_PER_HOUR;
}

function recordUsage(userId: string): void {
  const timestamps = usage.get(userId) ?? [];
  timestamps.push(Date.now());
  usage.set(userId, timestamps);
}

// ── System prompt per locale ────────────────────────────────────────────────

const SYSTEM_PROMPTS: Record<string, string> = {
  fr: [
    "Tu es l'assistant de MesPapiers, une application qui aide les particuliers à gérer leurs documents administratifs français.",
    "",
    "L'utilisateur te montre un de ses documents et te pose une question à son sujet.",
    "Tu as accès au document (image ou PDF) et à ses métadonnées (catégorie, date d'échéance, type de deadline).",
    "",
    "Règles :",
    "- Réponds en français, de façon claire et concise.",
    "- Tu es un assistant factuel : cite les textes officiels quand c'est pertinent (service-public.fr, legifrance.gouv.fr).",
    "- Pour les délais de renouvellement, donne les démarches concrètes (où aller, quels documents fournir, combien de temps ça prend).",
    "- Ne donne jamais de conseil juridique personnalisé. Oriente vers un professionnel si la question le demande.",
    "- Si tu mentionnes un prix ou un tarif, précise toujours : « À titre indicatif — vérifiez le tarif en vigueur sur le site officiel. »",
    "- Ne fabrique pas d'information. Si tu ne sais pas, dis-le.",
    "- Sois bienveillant : ces démarches sont souvent stressantes pour les gens.",
  ].join("\n"),

  en: [
    "You are the MesPapiers assistant, an app that helps people manage their French administrative documents.",
    "",
    "The user is showing you one of their documents and asking a question about it.",
    "You have access to the document (image or PDF) and its metadata (category, deadline date, deadline type).",
    "",
    "Rules:",
    "- Answer in English, clearly and concisely.",
    "- Be factual: cite official sources when relevant (service-public.fr, legifrance.gouv.fr).",
    "- For renewal deadlines, give concrete steps (where to go, which documents to bring, how long it takes).",
    "- Never give personalised legal advice. Direct the user to a professional if needed.",
    "- If you mention a price, always add: 'For reference only — check the current rate on the official website.'",
    "- Do not make up information. If you don't know, say so.",
    "- Be kind: these procedures are often stressful for people.",
  ].join("\n"),

  es: [
    "Eres el asistente de MesPapiers, una aplicación que ayuda a las personas a gestionar sus documentos administrativos franceses.",
    "",
    "El usuario te muestra uno de sus documentos y te hace una pregunta sobre él.",
    "Tienes acceso al documento (imagen o PDF) y a sus metadatos (categoría, fecha límite, tipo de plazo).",
    "",
    "Reglas:",
    "- Responde en español, de forma clara y concisa.",
    "- Sé factual: cita las fuentes oficiales cuando sea pertinente (service-public.fr, legifrance.gouv.fr).",
    "- Para los plazos de renovación, da los pasos concretos (dónde ir, qué documentos llevar, cuánto tiempo tarda).",
    "- Nunca des consejo jurídico personalizado. Dirige al usuario a un profesional si es necesario.",
    "- Si mencionas un precio, añade siempre: «A título indicativo — verifica la tarifa vigente en el sitio oficial.»",
    "- No inventes información. Si no lo sabes, dilo.",
    "- Sé amable: estos trámites suelen ser estresantes para la gente.",
  ].join("\n"),
};

function systemPrompt(locale: string): string {
  return SYSTEM_PROMPTS[locale] ?? SYSTEM_PROMPTS.fr!;
}

// ── Context block injected before the conversation ──────────────────────────

function documentContext(doc: AssistantRequest["document"], locale: string): string {
  const labels: Record<string, { category: string; deadline: string; expiry: string; status: string }> = {
    fr: { category: "Catégorie", deadline: "Type de deadline", expiry: "Date d'échéance", status: "Statut d'extraction" },
    en: { category: "Category", deadline: "Deadline type", expiry: "Expiry date", status: "Extraction status" },
    es: { category: "Categoría", deadline: "Tipo de plazo", expiry: "Fecha límite", status: "Estado de extracción" },
  };
  const l = labels[locale] ?? labels.fr!;

  const lines = [
    `${l.category}: ${doc.category}`,
    `${l.deadline}: ${doc.deadlineType ?? "—"}`,
    `${l.expiry}: ${doc.targetDate ? doc.targetDate.toISOString().slice(0, 10) : "—"}`,
    `${l.status}: ${doc.extractionStatus}`,
  ];
  return lines.join("\n");
}

// ── The streaming generator ─────────────────────────────────────────────────

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

export async function* streamAssistant(
  req: AssistantRequest,
  signal?: AbortSignal,
): AsyncGenerator<AssistantChunk> {
  if (!hasAnthropicKey()) {
    yield { type: "error", code: "NO_KEY", messageKey: "assistant.errors.noKey" };
    return;
  }

  if (isRateLimited(req.userId)) {
    yield { type: "error", code: "RATE_LIMITED", messageKey: "assistant.errors.rateLimited" };
    return;
  }

  recordUsage(req.userId);

  const isImage = (IMAGE_TYPES as readonly string[]).includes(req.document.fileType);
  const isPdf = req.document.fileType === "application/pdf";

  const data = req.document.fileData.toString("base64");
  const docBlock: Anthropic.ContentBlockParam = isPdf
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data } }
    : isImage
      ? {
          type: "image",
          source: {
            type: "base64",
            media_type: req.document.fileType as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
            data,
          },
        }
      : { type: "text", text: `[File: ${req.document.fileName}]` };

  const context = documentContext(req.document, req.locale);

  const history = req.history.slice(-MAX_HISTORY_MESSAGES);
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: [
        docBlock,
        { type: "text", text: context },
      ],
    },
    { role: "assistant", content: "OK." },
    ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user", content: req.question },
  ];

  try {
    const stream = anthropic().messages.stream({
      model: ASSISTANT_MODEL,
      max_tokens: 4096,
      system: systemPrompt(req.locale),
      messages,
    });

    signal?.addEventListener("abort", () => stream.abort(), { once: true });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        yield { type: "token", text: event.delta.text };
      }
    }

    const finalMessage = await stream.finalMessage();
    yield {
      type: "done",
      usage: {
        inputTokens: finalMessage.usage.input_tokens,
        outputTokens: finalMessage.usage.output_tokens,
      },
    };
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      yield { type: "error", code: "RATE_LIMITED", messageKey: "assistant.errors.rateLimited" };
      return;
    }
    if (error instanceof Anthropic.APIError && error.status === 529) {
      yield { type: "error", code: "UPSTREAM", messageKey: "assistant.errors.overloaded" };
      return;
    }
    if (error instanceof Anthropic.APIError) {
      yield { type: "error", code: "UPSTREAM", messageKey: "assistant.errors.upstream" };
      return;
    }
    yield { type: "error", code: "UPSTREAM", messageKey: "assistant.errors.upstream" };
  }
}
