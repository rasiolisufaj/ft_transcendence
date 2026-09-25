"use server";

import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { prisma } from "@/lib/db";
import { createHash } from "crypto";

export async function uploadDocument(formData: FormData) {
  //recuperer le fichier envoye par le formulaire
  const file = formData.get("file") as File;

  // aucun fichier envoye
  if (!file) {
    throw new Error("No file provided");
  }

  //verifier la taille
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("File is larger than 10 MB");
  } else if (file.size === 0) throw new Error("File is empty");

  // lire les octets du fichier et les ranger dans un Buffer
  const fileBuffer = Buffer.from(await file.arrayBuffer());

  // verifier le type du fichier
  const signPdf = fileBuffer.subarray(0, 4).toString("hex"); // 4 octets
  const signPng = fileBuffer.subarray(0, 8).toString("hex"); // 8 octets
  const signJpg = fileBuffer.subarray(0, 3).toString("hex"); // 3 octets

  if (
    signPdf !== "25504446" &&
    signPng !== "89504e470d0a1a0a" &&
    signJpg !== "ffd8ff"
  ) {
    redirect({ href: "/documents/error-file-type", locale: await getLocale() });
  }

  const fileHash = createHash("sha256").update(fileBuffer).digest("hex");

  const user = await prisma.user.findFirst({
    where: { email: "Amir@gmail.com" },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const sameContent = await prisma.document.findFirst({
    where: { ownerId: user.id, fileHash: fileHash },
  });

  if (sameContent) {
    redirect({ href: "/documents/error-duplicate-content", locale: await getLocale() });
  }

  const sameName = await prisma.document.findFirst({
    where: { ownerId: user.id, fileName: file.name },
  });

  if (sameName) {
    redirect({ href: "/documents/error-duplicate", locale: await getLocale() });
  }

  await prisma.document.create({
    data: {
      ownerId: user.id,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      fileData: fileBuffer,
      fileHash: fileHash,
    },
  });
  redirect({ href: "/", locale: await getLocale() });
}
