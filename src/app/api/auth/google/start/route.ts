import { NextResponse } from "next/server";
import {
  OAUTH_COOKIE,
  OAUTH_COOKIE_PATH,
  challengeFor,
  googleRedirectUri,
  randomToken,
} from "@/lib/auth/oauth";

/** 8.2: sends the browser to Google's consent screen, with a fresh state and PKCE verifier in a cookie. */
export function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  // A checkout without Google keys (every teammate's) lands on the login page, not on Google's error page.
  if (!clientId) {
    return NextResponse.redirect(new URL("/login?error=oauth", process.env.APP_URL));
  }

  const state = randomToken();
  const verifier = randomToken();
  const google = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  google.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: challengeFor(verifier),
    code_challenge_method: "S256",
  }).toString();

  const res = NextResponse.redirect(google);
  // base64url has no ".", so the callback splits on it.
  res.cookies.set(OAUTH_COOKIE, `${state}.${verifier}`, {
    httpOnly: true,
    secure: true,
    // lax, not strict: Google's redirect back is a cross-site navigation, which strict would strip the cookie from.
    sameSite: "lax",
    path: OAUTH_COOKIE_PATH,
    maxAge: 600,
  });
  return res;
}
