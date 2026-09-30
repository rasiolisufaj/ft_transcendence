"use server";

import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { prisma } from "@/lib/db";
import { createHash } from "crypto";
import { requireUser } from "@/lib/auth/session";
import { classifyDocument, extractionStatusFor } from "@/lib/documents/classify";
import { narrowSubtypeFields } from "@/lib/documents/subtypes";
import { ExtractionStatus } from "@/generated/prisma/enums";

export async function uploadDocument(formData: FormData) {
  const { user } = await requireUser();

  const file = formData.get("file") as File;

  if (!file) {
    throw new Error("No file provided");
  }

  if (file.size > 10 * 1024 * 1024) {
    throw new Error("File is larger than 10 MB");
  } else if (file.size === 0) throw new Error("File is empty");

  const fileBuffer = Buffer.from(await file.arrayBuffer());

  const signPdf = fileBuffer.subarray(0, 4).toString("hex");
  const signPng = fileBuffer.subarray(0, 8).toString("hex");
  const signJpg = fileBuffer.subarray(0, 3).toString("hex");

  if (
    signPdf !== "25504446" &&
    signPng !== "89504e470d0a1a0a" &&
    signJpg !== "ffd8ff"
  ) {
    redirect({ href: "/documents/error-file-type", locale: await getLocale() });
  }

  const fileHash = createHash("sha256").update(fileBuffer).digest("hex");

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

  const classification = await classifyDocument({
    buffer: fileBuffer,
    mimeType: file.type,
    fileName: file.name,
  });

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

  redirect({ href: "/", locale: await getLocale() });
}
