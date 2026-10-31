import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  OAUTH_COOKIE,
  OAUTH_COOKIE_PATH,
  googleProfileSchema,
  googleRedirectUri,
  resolveGoogleUser,
} from "@/lib/auth/oauth";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

const tokenSchema = z.object({ access_token: z.string().min(1) });

/** Every answer clears the cookie, so each state and verifier works once (C7). */
function finish(path: string) {
  const res = NextResponse.redirect(new URL(path, process.env.APP_URL));
  res.cookies.set(OAUTH_COOKIE, "", { path: OAUTH_COOKIE_PATH, maxAge: 0 });
  return res;
}
// One message for every failure; Google's own text is never shown.
const failed = () => finish("/login?error=oauth");

/** 8.3: Google sends the browser back here with ?code&state, or ?error&state when the user cancelled. */
export async function GET(request: NextRequest) {
  const [state, verifier] = request.cookies.get(OAUTH_COOKIE)?.value.split(".") ?? [];
  const code = request.nextUrl.searchParams.get("code");
  if (!state || !verifier || !code || request.nextUrl.searchParams.get("state") !== state) {
    return failed();
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID ?? "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
        code,
        code_verifier: verifier,
        grant_type: "authorization_code",
        redirect_uri: googleRedirectUri(),
      }),
    });
    if (!tokenRes.ok) {
      // Google's `error` field says why (invalid_grant, redirect_uri_mismatch, invalid_client); it holds no secret.
      throw new Error(`Google's token endpoint answered ${tokenRes.status}: ${(await tokenRes.text()).slice(0, 200)}`);
    }
    const { access_token } = tokenSchema.parse(await tokenRes.json());

    const infoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!infoRes.ok) throw new Error(`Google's userinfo endpoint answered ${infoRes.status}`);
    const profile = googleProfileSchema.parse(await infoRes.json());

    const userId = await resolveGoogleUser(profile);
    if (!userId) return failed(); // an unverified email, or a link Google cannot vouch for

    // A new Session row and cookie, as a password login does (C11 rotation).
    const session = await createSession(userId);
    await setSessionCookie(session.token, session.expiresAt);

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { totpEnabled: true } });
    if (user?.totpEnabled) return finish("/login/2fa");
  } catch (error) {
    // Google unreachable or refusing, an answer we cannot read, a database error.
    console.error("Google sign-in failed:", error);
    return failed();
  }
  return finish("/");
}
