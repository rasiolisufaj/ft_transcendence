"use server";

import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { getSeedUser } from "@/lib/auth/seed-user";

export async function deleteDocument(formData: FormData) {
  //  Recuperer l'id du document envoye par le formulaire
  const idFile = Number(formData.get("id"));

  if (!idFile) {
    throw new Error("id invalide");
  }

  const user = await getSeedUser();

  const doc = await prisma.document.findFirst({
    where: {
      id: idFile,
      ownerId: user.id,
    },
  });

  if (!doc) {
    throw new Error("ce document n'existe pas ou ne t'appartient pas");
  }

  await prisma.document.delete({
    where: { id: idFile },
  });

  // Sans préfixe de locale : le middleware normalise vers la locale par défaut.
  // D10 le rendra locale-aware avec le `redirect` de next-intl.
  redirect("/");
}
