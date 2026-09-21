import { prisma } from "@/lib/db";



export async function GET(request: Request) {
  // recupere ladresse complete de la requete
  const url = request.url;

  // decoupe la chaine
  const splitUrl: string[] = url.split("/");

  // prend le dernier morceau 
  const idFile = splitUrl[splitUrl.length - 1];

  // si  nexiste pas ou est vide
  if (!idFile) {
    return Response.json({ error: "id manquant" }, { status: 400 });
  }

  // convertit le texte en nombre 
  const id = parseInt(idFile, 10);

  if (Number.isNaN(id) || id <= 0 || String(id) !== idFile) {
    return Response.json({ error: "id invalide" }, { status: 400 });
  }
// va recupere le user dans la basse de donnee
const user = await prisma.user.findFirst({
    where: { email: "Amir@gmail.com" },
});
 // si il nexiste pas 
  if (!user) {
    throw new Error("Utilisateur introuvable");
  }

// verifie si le document apartien au user
const doc = await prisma.document.findFirst({
    where: {
        id: id,
        ownerId: user.id,
    },
});
 if (!doc) {
    throw new Error("ce document n'existe pas ou ne t'appartient pas");
  }
  return new Response(new Uint8Array(doc.fileData), {
  status: 200,
  headers: {
    "Content-Type": doc.fileType,
    "Content-Disposition": "inline",
  },
});
}
