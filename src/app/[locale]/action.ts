"use server";

import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { getSeedUser } from "@/lib/auth/seed-user";

export async function deleteDocument(formData: FormData) {
  // Read the document id sent by the form
  const idFile = Number(formData.get("id"));

  if (!idFile) {
    throw new Error("invalid id");
  }

  const user = await getSeedUser();

  const doc = await prisma.document.findFirst({
    where: {
      id: idFile,
      ownerId: user.id,
    },
  });

  if (!doc) {
    throw new Error("this document does not exist, or is not yours");
  }

  await prisma.document.delete({
    where: { id: idFile },
  });

  // No locale prefix: the middleware normalises to the default locale. D10 will
  // make this locale-aware with next-intl's own `redirect`.
  redirect("/");
}
