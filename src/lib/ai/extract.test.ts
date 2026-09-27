import Anthropic from "@anthropic-ai/sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CATEGORIES, CATEGORY_KEYS } from "@/lib/documents/subtypes";

// Only our own client module is mocked, never the SDK itself — the real
// Anthropic error classes have to stay intact for the instanceof checks in
// extract.ts to mean anything. PROJECT_PLAN: AI tests never make live calls.
const parse = vi.fn();
let keyPresent = true;

vi.mock("@/lib/ai/client", () => ({
  EXTRACTION_MODEL: "claude-opus-5",
  anthropic: () => ({ messages: { parse } }),
  hasAnthropicKey: () => keyPresent,
}));

const { extractDocument, outputSchema, systemPrompt } = await import("@/lib/ai/extract");

const identityReply = {
  stop_reason: "end_turn",
  parsed_output: {
    category: "IDENTITY",
    deadlineType: "HARD",
    targetDate: "2031-04-11",
    confidence: 0.93,
    fields: {
      fullName: "Adrien Regis",
      birthDate: "1998-04-12",
      documentNumber: "19AB45678",
      expiryDate: "2031-04-11",
      provider: null,
      policyNumber: null,
      vehiclePlate: null,
    },
  },
  usage: { input_tokens: 1820, output_tokens: 140 },
};

const jpeg = { buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00]), mimeType: "image/jpeg", fileName: "id.jpg" };
const pdf = { buffer: Buffer.from("%PDF-1.4"), mimeType: "application/pdf", fileName: "doc.pdf" };

beforeEach(() => {
  parse.mockReset();
  keyPresent = true;
});

describe("the prompt sent to the model", () => {
  // If a category existed only in the registry and never reached the prompt, the
  // model could not classify into it — the card would exist and stay empty.
  it("names every category and its hint", () => {
    const prompt = systemPrompt();
    for (const key of CATEGORY_KEYS) {
      expect(prompt).toContain(key);
      expect(prompt).toContain(CATEGORIES[key].aiHint);
    }
  });

  it("tells the model to prefer null over a guess", () => {
    expect(systemPrompt()).toMatch(/never guess/i);
  });

  it("explains all four deadline types", () => {
    const prompt = systemPrompt();
    for (const type of ["HARD", "SOFT", "PERIODIC", "NONE"]) {
      expect(prompt).toContain(type);
    }
  });

  // This is the distinction the whole NONE value exists for. Without it the
  // model conflates "no expiry date" with "I could not read the expiry date",
  // and every payslip ends up asking for human attention forever.
  it("distinguishes NONE from an unreadable date", () => {
    expect(systemPrompt()).toMatch(/NONE means there is nothing to find/i);
  });
});

describe("the output schema", () => {
  it("accepts a well-formed reply", () => {
    expect(outputSchema().safeParse(identityReply.parsed_output).success).toBe(true);
  });

  it("rejects a category the registry does not know", () => {
    const bad = { ...identityReply.parsed_output, category: "CRYPTO_WALLET" };
    expect(outputSchema().safeParse(bad).success).toBe(false);
  });

  it("rejects a confidence outside 0-1", () => {
    const bad = { ...identityReply.parsed_output, confidence: 1.4 };
    expect(outputSchema().safeParse(bad).success).toBe(false);
  });

  // The merged field object is derived from the registry, so every subtype field
  // must be expressible — otherwise the model has no way to return it.
  it("covers every field of every subtype", () => {
    const shape = outputSchema().shape.fields.shape;
    for (const key of CATEGORY_KEYS) {
      const { subtype } = CATEGORIES[key];
      if (subtype === null) continue;
      for (const field of Object.keys(subtype.schema.shape)) {
        expect(shape).toHaveProperty(field);
      }
    }
  });

  it("accepts every deadline type the database knows", () => {
    for (const deadlineType of ["HARD", "SOFT", "PERIODIC", "NONE"]) {
      const candidate = { ...identityReply.parsed_output, deadlineType, targetDate: null };
      expect(outputSchema().safeParse(candidate).success).toBe(true);
    }
  });

  it("rejects a deadline type the database does not know", () => {
    const bad = { ...identityReply.parsed_output, deadlineType: "WHENEVER" };
    expect(outputSchema().safeParse(bad).success).toBe(false);
  });

  // The model must be allowed to admit it could not decide, rather than picking
  // a deadline type at random to satisfy a non-nullable schema.
  it("allows a null deadline type and a null date", () => {
    const undecided = { ...identityReply.parsed_output, deadlineType: null, targetDate: null };
    expect(outputSchema().safeParse(undecided).success).toBe(true);
  });

  it("rejects a date that is not an ISO calendar date", () => {
    const bad = { ...identityReply.parsed_output, targetDate: "11/04/2031" };
    expect(outputSchema().safeParse(bad).success).toBe(false);
  });

  it("allows null for any field", () => {
    const allNull = Object.fromEntries(
      Object.keys(outputSchema().shape.fields.shape).map((f) => [f, null]),
    );
    const result = outputSchema().safeParse({
      category: "OTHER",
      deadlineType: null,
      targetDate: null,
      confidence: 0.2,
      fields: allNull,
    });
    expect(result.success).toBe(true);
  });
});

describe("extractDocument", () => {
  it("returns the category, fields and confidence on success", async () => {
    parse.mockResolvedValue(identityReply);
    const result = await extractDocument(jpeg);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.category).toBe("IDENTITY");
      expect(result.confidence).toBe(0.93);
      expect(result.usage).toEqual({ inputTokens: 1820, outputTokens: 140 });
    }
  });

  // Nulls are the model saying "not on this document". Forwarding them would
  // fail the category's required fields with a confusing reason.
  it("strips null fields before returning", async () => {
    parse.mockResolvedValue(identityReply);
    const result = await extractDocument(jpeg);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.fields).toEqual({
        fullName: "Adrien Regis",
        birthDate: "1998-04-12",
        documentNumber: "19AB45678",
        expiryDate: "2031-04-11",
      });
      expect(result.fields).not.toHaveProperty("provider");
    }
  });

  it("sends an image block for an image", async () => {
    parse.mockResolvedValue(identityReply);
    await extractDocument(jpeg);
    const content = parse.mock.calls[0]?.[0].messages[0].content;
    expect(content[0].type).toBe("image");
    expect(content[0].source.media_type).toBe("image/jpeg");
  });

  it("sends a document block for a PDF", async () => {
    parse.mockResolvedValue(identityReply);
    await extractDocument(pdf);
    const content = parse.mock.calls[0]?.[0].messages[0].content;
    expect(content[0].type).toBe("document");
    expect(content[0].source.media_type).toBe("application/pdf");
  });

  it("puts the file before the instruction", async () => {
    parse.mockResolvedValue(identityReply);
    await extractDocument(pdf);
    const content = parse.mock.calls[0]?.[0].messages[0].content;
    expect(content[1].type).toBe("text");
  });

  it("returns the deadline the model chose", async () => {
    parse.mockResolvedValue(identityReply);
    const result = await extractDocument(jpeg);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.deadlineType).toBe("HARD");
      expect(result.targetDate).toBe("2031-04-11");
    }
  });

  // NONE and a date together is a contradiction. The type wins: it answers "can
  // this ever expire", and a date under NONE would leak into the deadline scan.
  it("drops the date when the model says NONE but returns one anyway", async () => {
    parse.mockResolvedValue({
      ...identityReply,
      parsed_output: {
        ...identityReply.parsed_output,
        deadlineType: "NONE",
        targetDate: "2031-04-11",
      },
    });
    const result = await extractDocument(jpeg);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.deadlineType).toBe("NONE");
      expect(result.targetDate).toBeNull();
    }
  });

  it("asks for claude-opus-5", async () => {
    parse.mockResolvedValue(identityReply);
    await extractDocument(jpeg);
    expect(parse.mock.calls[0]?.[0].model).toBe("claude-opus-5");
  });
});

describe("extractDocument failure modes", () => {
  it("reports NO_KEY without calling the API", async () => {
    keyPresent = false;
    const result = await extractDocument(jpeg);
    expect(result).toMatchObject({ ok: false, reason: "NO_KEY" });
    expect(parse).not.toHaveBeenCalled();
  });

  it("reports UNSUPPORTED_TYPE without calling the API", async () => {
    const result = await extractDocument({ ...jpeg, mimeType: "application/zip" });
    expect(result).toMatchObject({ ok: false, reason: "UNSUPPORTED_TYPE" });
    expect(parse).not.toHaveBeenCalled();
  });

  // A decline is an HTTP 200 with stop_reason "refusal", not a thrown error.
  it("reports REFUSED when the model declines", async () => {
    parse.mockResolvedValue({
      stop_reason: "refusal",
      stop_details: { type: "refusal", category: "cyber", explanation: "declined" },
      parsed_output: null,
      usage: { input_tokens: 10, output_tokens: 0 },
    });
    const result = await extractDocument(jpeg);
    expect(result).toMatchObject({ ok: false, reason: "REFUSED" });
  });

  it("reports MALFORMED when the reply does not match the schema", async () => {
    parse.mockResolvedValue({
      stop_reason: "end_turn",
      parsed_output: null,
      usage: { input_tokens: 10, output_tokens: 5 },
    });
    const result = await extractDocument(jpeg);
    expect(result).toMatchObject({ ok: false, reason: "MALFORMED" });
  });

  it("reports RATE_LIMITED on a 429", async () => {
    parse.mockRejectedValue(
      new Anthropic.RateLimitError(429, undefined, "too many requests", new Headers()),
    );
    const result = await extractDocument(jpeg);
    expect(result).toMatchObject({ ok: false, reason: "RATE_LIMITED" });
  });

  it("reports UPSTREAM on a server error", async () => {
    parse.mockRejectedValue(
      new Anthropic.InternalServerError(500, undefined, "upstream exploded", new Headers()),
    );
    const result = await extractDocument(jpeg);
    expect(result).toMatchObject({ ok: false, reason: "UPSTREAM" });
  });

  it("never throws, whatever the SDK does", async () => {
    parse.mockRejectedValue(new Error("something unexpected"));
    await expect(extractDocument(jpeg)).resolves.toMatchObject({ ok: false });
  });
});
