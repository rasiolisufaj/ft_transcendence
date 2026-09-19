"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { createHash } from "crypto";

export async function uploadDocument(formData: FormData) {
  await new Promise((r) => setTimeout(r, 1500));
  //recuperer le fichier envoye par le formulaire
  const file = formData.get("file") as File;

  // aucun fichier envoye
  if (!file) {
    throw new Error("fichier vide");
  }

  //verifier la taille
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("fichier superieur a 10 mo");
  }

  // lire les octets du fichier et les ranger dans un Buffer
  const fileBuffer = Buffer.from(await file.arrayBuffer());

  // verifier le type du fichier
  const signPdf = fileBuffer.subarray(0, 4).toString("hex"); // 4 octets
  const signPng = fileBuffer.subarray(0, 8).toString("hex"); // 8 octets
  const signJpg = fileBuffer.subarray(0, 3).toString("hex"); // 3 octets

  if (
    signPdf !== "25504446" && // %PDF
    signPng !== "89504e470d0a1a0a" &&
    signJpg !== "ffd8ff"
  ) {
    redirect("/documents/error-file-type");
  }

  const fileHash = createHash("sha256").update(fileBuffer).digest("hex");

  const user = await prisma.user.findFirst({
    where: { email: "Amir@gmail.com" },
  });

  if (!user) {
    throw new Error("Utilisateur introuvable");
  }

  const sameContent = await prisma.document.findFirst({
    where: { ownerId: user.id, fileHash: fileHash },
  });

  if (sameContent) {
    redirect("/documents/error-duplicate-content");
  }

  const sameName = await prisma.document.findFirst({
    where: { ownerId: user.id, fileName: file.name },
  });

  if (sameName) {
    redirect("/documents/error-duplicate");
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
  redirect("/");
}
