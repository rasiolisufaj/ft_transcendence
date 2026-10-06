import { getCurrentUser } from "@/lib/auth/session";
import { mintTicket } from "@/lib/auth/ticket";

// 401, not requireUser(): an API route must not redirect to the HTML login page.
export async function POST() {
  const ctx = await getCurrentUser();
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json({ ticket: mintTicket(ctx.user.id) });
}
