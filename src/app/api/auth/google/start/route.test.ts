import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { challengeFor } from "@/lib/auth/oauth";
import { GET } from "./route";

beforeEach(() => {
  vi.stubEnv("APP_URL", "https://localhost");
  vi.stubEnv("GOOGLE_CLIENT_ID", "client-id");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/auth/google/start", () => {
  it("sends the browser to Google with an S256 challenge, and keeps state and verifier in a 10-minute cookie", () => {
    const res = GET();

    const to = new URL(res.headers.get("location")!);
    expect(`${to.origin}${to.pathname}`).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(to.searchParams.get("client_id")).toBe("client-id");
    expect(to.searchParams.get("redirect_uri")).toBe("https://localhost/api/auth/google/callback");
    expect(to.searchParams.get("response_type")).toBe("code");
    expect(to.searchParams.get("code_challenge_method")).toBe("S256");

    const cookie = res.headers.getSetCookie().find((c) => c.startsWith("mp_oauth="))!;
    const [state, verifier] = cookie.slice("mp_oauth=".length).split(";")[0]!.split(".");
    expect(to.searchParams.get("state")).toBe(state);
    expect(to.searchParams.get("code_challenge")).toBe(challengeFor(verifier!));
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Max-Age=600/i);
    expect(cookie).toMatch(/Path=\/api\/auth\/google/);
  });

  it("goes back to the login page when no Google client is configured", () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "");

    const res = GET();

    expect(res.headers.get("location")).toBe("https://localhost/login?error=oauth");
    expect(res.headers.getSetCookie()).toEqual([]);
  });
});
