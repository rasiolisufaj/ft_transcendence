"use server";

import { prisma } from "@/lib/db";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth/session";

export async function deleteDocument(formData: FormData) {
  const idFile = Number(formData.get("id"));

  if (!idFile) {
    throw new Error("invalid id");
  }

  const { user } = await requireUser();

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

  redirect({ href: "/", locale: await getLocale() });
}
