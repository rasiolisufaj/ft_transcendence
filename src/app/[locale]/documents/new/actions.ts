"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { createHash } from "crypto";
import { getSeedUser } from "@/lib/auth/seed-user";
import { classifyDocument, extractionStatusFor } from "@/lib/documents/classify";
import { narrowSubtypeFields } from "@/lib/documents/subtypes";
import { ExtractionStatus } from "@/generated/prisma/enums";

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
    redirect("/documents/error-file-type");
  }

  const fileHash = createHash("sha256").update(fileBuffer).digest("hex");

  const user = await getSeedUser();

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

  // Classement du document. Aucun modèle ne tourne encore : la couture renvoie
  // OTHER / PENDING, et l'UI l'affiche comme « en attente de classement ».
  // Brancher B3 ne changera que le corps de classifyDocument().
  const classification = await classifyDocument({
    buffer: fileBuffer,
    mimeType: file.type,
    fileName: file.name,
  });

  // Les champs proposés passent par le schéma de leur catégorie avant tout
  // contact avec la base (PROJECT_PLAN B3). Une catégorie devinée dont les
  // champs ne valident pas reste la catégorie, mais attend un humain.
  const narrowed = narrowSubtypeFields(classification.category, classification.subtypeFields);
  const extractionStatus = narrowed.ok
    ? extractionStatusFor(classification)
    : ExtractionStatus.NEEDS_REVIEW;

  await prisma.document.create({
    data: {
      ownerId: user.id,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      fileData: fileBuffer,
      fileHash: fileHash,
      category: classification.category,
      extractionStatus,
    },
  });

  // TODO(B3) : quand classifyDocument() renverra des champs, écrire la ligne
  // typée dans la même transaction que la ligne de base. Le switch sur
  // `narrowed.model` appartient à subtypes.ts, pour qu'ajouter une catégorie
  // continue de ne toucher qu'un seul fichier.

  redirect("/");
}
