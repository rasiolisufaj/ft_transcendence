import { randomUUID } from "node:crypto";
import * as OTPAuth from "otpauth";
import { afterEach, describe, expect, it, vi } from "vitest";
import { redirect } from "@/i18n/navigation";
import {
  createSession,
  getPendingTwoFactorSession,
  setSessionCookie,
  validateSessionToken,
} from "@/lib/auth/session";
import { createSecret } from "@/lib/auth/totp";
import { prisma } from "@/lib/db";
import { verifyTwoFactor } from "./actions";

// The cookie is read and written through these two; everything else in session.ts is real.
vi.mock("@/lib/auth/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/session")>()),
  getPendingTwoFactorSession: vi.fn(),
  setSessionCookie: vi.fn(),
}));
vi.mock("next-intl/server", () => ({ getLocale: vi.fn(async () => "fr") }));
vi.mock("@/i18n/navigation", () => ({ redirect: vi.fn() }));

const created: string[] = [];

afterEach(async () => {
  vi.clearAllMocks();
  await prisma.user.deleteMany({ where: { id: { in: created } } });
  created.length = 0;
});

describe("verifyTwoFactor", () => {
  it("swaps the pending session for a new verified one, so the cookie changes and the nav refreshes", async () => {
    const secret = createSecret();
    const user = await prisma.user.create({
      data: {
        email: `test-${randomUUID()}@mespapiers.test`,
        displayName: "Test",
        totpEnabled: true,
        totpSecret: secret,
      },
    });
    created.push(user.id);
    const pending = await createSession(user.id);
    vi.mocked(getPendingTwoFactorSession).mockResolvedValue((await validateSessionToken(pending.token))!);
    const f = new FormData();
    f.set("code", new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret) }).generate());

    await verifyTwoFactor({}, f);

    expect(await validateSessionToken(pending.token)).toBeNull();
    expect(vi.mocked(setSessionCookie)).toHaveBeenCalledTimes(1);
    const [token] = vi.mocked(setSessionCookie).mock.calls[0]!;
    expect((await validateSessionToken(token))?.session.twoFactorVerified).toBe(true);
    expect(vi.mocked(redirect)).toHaveBeenCalledWith({ href: "/", locale: "fr" });
  });
});
