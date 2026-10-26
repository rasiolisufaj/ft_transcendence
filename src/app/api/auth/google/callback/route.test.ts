import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setSessionCookie } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { GET } from "./route";

// next/headers' cookies() needs a request scope; createSession() stays real.
vi.mock("@/lib/auth/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/session")>()),
  setSessionCookie: vi.fn(),
}));

const fetchMock = vi.fn();
const STATE = "the-state";
const VERIFIER = "the-verifier";
const LOGIN_ERROR = "https://localhost/login?error=oauth";

function callback(query: string, cookie: string | null = `${STATE}.${VERIFIER}`) {
  return GET(
    new NextRequest(`https://localhost/api/auth/google/callback?${query}`, {
      headers: cookie ? { cookie: `mp_oauth=${cookie}` } : {},
    }),
  );
}
const clearsTheCookie = (res: Response) =>
  res.headers.getSetCookie().some((c) => c.startsWith("mp_oauth=;") && /Max-Age=0/i.test(c));

const emails: string[] = [];

beforeEach(() => {
  vi.stubEnv("APP_URL", "https://localhost");
  vi.stubEnv("GOOGLE_CLIENT_ID", "client-id");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "client-secret");
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
  vi.clearAllMocks();
  await prisma.user.deleteMany({ where: { email: { in: emails } } });
  emails.length = 0;
});

describe("GET /api/auth/google/callback", () => {
  it("refuses a state that does not match its cookie, before calling Google", async () => {
    const res = await callback("code=c&state=another-state");

    expect(res.headers.get("location")).toBe(LOGIN_ERROR);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(clearsTheCookie(res)).toBe(true);
  });

  it("signs in with the verifier, clears the cookie, and refuses the same callback replayed", async () => {
    const email = `test-${randomUUID()}@mespapiers.test`;
    emails.push(email);
    fetchMock
      .mockResolvedValueOnce(Response.json({ access_token: "access" }))
      .mockResolvedValueOnce(Response.json({ sub: randomUUID(), email, email_verified: true, name: "Test" }));

    const res = await callback(`code=c&state=${STATE}`);

    expect(res.headers.get("location")).toBe("https://localhost/");
    expect(setSessionCookie).toHaveBeenCalledOnce();
    expect(clearsTheCookie(res)).toBe(true);
    const [tokenUrl, init] = fetchMock.mock.calls[0]!;
    expect(tokenUrl).toBe("https://oauth2.googleapis.com/token");
    expect((init.body as URLSearchParams).get("code")).toBe("c");
    expect((init.body as URLSearchParams).get("code_verifier")).toBe(VERIFIER);

    // The browser no longer has the cookie: the same URL again is refused without calling Google.
    const replay = await callback(`code=c&state=${STATE}`, null);
    expect(replay.headers.get("location")).toBe(LOGIN_ERROR);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("ends on the login page, not a 500, when the user cancels, Google is down, or Google answers an error page", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    const cancelled = await callback(`error=access_denied&state=${STATE}`);
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    const down = await callback(`code=c&state=${STATE}`);
    fetchMock.mockResolvedValueOnce(new Response("<html>Bad Gateway</html>", { status: 502 }));
    const errorPage = await callback(`code=c&state=${STATE}`);

    for (const res of [cancelled, down, errorPage]) expect(res.headers.get("location")).toBe(LOGIN_ERROR);
    expect(setSessionCookie).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledTimes(2); // a cancel is the user's choice, not an error to log
    log.mockRestore();
  });

  it("logs why Google refused the code", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockResolvedValueOnce(Response.json({ error: "invalid_grant" }, { status: 400 }));

    await callback(`code=c&state=${STATE}`);

    expect(String(log.mock.calls[0]?.[1])).toContain("invalid_grant");
    log.mockRestore();
  });
});
