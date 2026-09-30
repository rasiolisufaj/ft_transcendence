import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const p = await params;

  const idFile = p.id;

  // convertit le texte en nombre 
  const id = parseInt(idFile, 10);
  if (Number.isNaN(id) || id <= 0 || String(id) !== idFile) {
    return Response.json({ error: "id invalide" }, { status: 400 });
  }
  // un route handler renvoie 401 au lieu de rediriger vers /login
  const ctx = await getCurrentUser();
  if (!ctx) {
    return new Response(null, { status: 401 });
  }

  // verifie si le document apartien au user
  const doc = await prisma.document.findFirst({
    where: {
      id: id,
      ownerId: ctx.user.id,
    },
  });
  // 404 aussi pour le document d'un autre : on ne revele pas qu'il existe
  if (!doc) {
    return new Response(null, { status: 404 });
  }
  return new Response(new Uint8Array(doc.fileData), {
    status: 200,
    headers: {
      "Content-Type": doc.fileType,
      "Content-Disposition": "inline",
    },
  });
}
