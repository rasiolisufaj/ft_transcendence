import Anthropic from "@anthropic-ai/sdk";

/**
 * The Anthropic client, created once per process.
 *
 * The key is never passed explicitly: the SDK reads ANTHROPIC_API_KEY from the
 * environment. Compose forwards it to the `web` service, and PROJECT_PLAN §0
 * requires it to live only in `.env`.
 */

export const EXTRACTION_MODEL = "claude-opus-5";

let client: Anthropic | null = null;

/**
 * Throws when the key is missing rather than letting the SDK fail on the first
 * request — the caller turns this into a FAILED extraction with a clear reason,
 * instead of a 500 that looks like a bug in the upload.
 */
export function anthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set — see .env.example");
  }
  client ??= new Anthropic();
  return client;
}

export function hasAnthropicKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}
