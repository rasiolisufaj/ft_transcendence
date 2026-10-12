"use server";

import { prisma } from "@/lib/db";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth/session";

export async function deleteDocument(formData: FormData) {
  const { user } = await requireUser();
  const locale = await getLocale();
  const idFile = Number(formData.get("id"));

  if (!Number.isInteger(idFile)) {
    return redirect({ href: "/", locale });
  }

  if (idFile <= 0) {
    return redirect({ href: "/", locale });
  }

  await prisma.document.deleteMany({
    where: { id: idFile, ownerId: user.id },
  });

  redirect({ href: "/", locale });
}