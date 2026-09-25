"use server";

import { prisma } from "@/lib/db";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";

export async function deleteDocument(formData: FormData) {
  //  Recuperer l'id du document envoye par le formulaire
  const idFile = Number(formData.get("id"));

  if (!idFile) {
    throw new Error("id invalide");
  }

  const user = await prisma.user.findFirst({
    where: { email: "Amir@gmail.com" },
  });

  if (!user) {
    throw new Error("Utilisateur introuvable");
  }

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

  redirect({ href: "/", locale: await getLocale() });
}
