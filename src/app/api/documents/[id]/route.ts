import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";

// Types qu'on accepte de servir au navigateur ; tout autre contenu part en octet-stream.
const SAFE_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

// Nettoie le nom pour l'entete Content-Disposition (seulement ascii, pas de ")
function safeFileName(name: string): string {
  const stripped = name.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
  return stripped.length > 0 ? stripped : "document";
}

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

  // n'envoie le type stocke que s'il est dans la liste blanche,
  // sinon octet-stream : jamais text/html ni autre chose executable.
  const contentType = SAFE_TYPES.has(doc.fileType)
    ? doc.fileType
    : "application/octet-stream";

  return new Response(new Uint8Array(doc.fileData), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${safeFileName(doc.fileName)}"`,
      // le navigateur refuse de deviner un type different (empeche le sniffing)
      "X-Content-Type-Options": "nosniff",
      // pas d'execution de script, pas de requete externe, seules les images same-origin
      "Content-Security-Policy": "default-src 'none'; img-src 'self';",
    },
  });
}
