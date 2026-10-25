import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { isUserId } from "@/lib/users/profile";

// Any signed-in user may load any avatar: profiles are open to every signed-in user.
// The profile page, not this route, hides a profile across a block.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  // A Route Handler answers 401 instead of redirecting to /login.
  if (!(await getCurrentUser())) {
    return new Response(null, { status: 401 });
  }

  const { id } = await params;
  const avatar = isUserId(id) ? await prisma.userAvatar.findUnique({ where: { userId: id } }) : null;
  if (!avatar) {
    return new Response(null, { status: 404 });
  }

  return new Response(new Uint8Array(avatar.data), {
    headers: {
      "Content-Type": avatar.mimeType,
      // The bytes decided the type at upload; never let the browser guess another one.
      "X-Content-Type-Options": "nosniff",
      // PROJECT_PLAN §2: files are private and never cached.
      "Cache-Control": "private, no-store",
    },
  });
}
