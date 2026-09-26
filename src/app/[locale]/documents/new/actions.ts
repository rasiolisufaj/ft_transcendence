"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { createHash } from "crypto";
import { getSeedUser } from "@/lib/auth/seed-user";
import { classifyDocument, extractionStatusFor } from "@/lib/documents/classify";
import { narrowSubtypeFields } from "@/lib/documents/subtypes";
import { ExtractionStatus } from "@/generated/prisma/enums";

export async function uploadDocument(formData: FormData) {
  // Read the file sent by the form
  const file = formData.get("file") as File;

  // No file was sent
  if (!file) {
    throw new Error("No file provided");
  }

  // Check the size
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("File is larger than 10 MB");
  } else if (file.size === 0) throw new Error("File is empty");

  // Read the file bytes into a Buffer
  const fileBuffer = Buffer.from(await file.arrayBuffer());

  // Check the real file type from its magic bytes
  const signPdf = fileBuffer.subarray(0, 4).toString("hex"); // 4 bytes
  const signPng = fileBuffer.subarray(0, 8).toString("hex"); // 8 bytes
  const signJpg = fileBuffer.subarray(0, 3).toString("hex"); // 3 bytes

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

  // Sort the document. No model runs yet: the seam returns OTHER / PENDING and
  // the UI shows it as awaiting classification. Wiring B3 will only change the
  // body of classifyDocument().
  const classification = await classifyDocument({
    buffer: fileBuffer,
    mimeType: file.type,
    fileName: file.name,
  });

  // Proposed fields go through their category's schema before touching the
  // database (PROJECT_PLAN B3). A guessed category whose fields fail validation
  // keeps the category but waits for a human.
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

  // TODO(B3): once classifyDocument() returns fields, write the typed row in the
  // same transaction as the base row. The switch on `narrowed.model` belongs in
  // subtypes.ts, so that adding a category still touches only one file.

  redirect("/");
}
