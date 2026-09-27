"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { createHash } from "crypto";
import { getSeedUser } from "@/lib/auth/seed-user";
import { classifyDocument, extractionStatusFor } from "@/lib/documents/classify";
import { narrowSubtypeFields, writeSubtypeRow } from "@/lib/documents/subtypes";
import { ExtractionStatus } from "@/generated/prisma/enums";

/**
 * Extractions per user per 24h. The assistant is metered separately (B11); this
 * one only guards the classification cost of uploads.
 */
const DAILY_EXTRACTION_CAP = 20;

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

  // Cost guard (PROJECT_PLAN B7 / R7). Past the cap we still keep the document —
  // it simply stays unclassified, rather than being refused outright — so a busy
  // day never loses a user's paperwork.
  const uploadsToday = await prisma.document.count({
    where: { ownerId: user.id, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });
  const overDailyCap = uploadsToday >= DAILY_EXTRACTION_CAP;

  // Ask the model where this document belongs. The call is awaited, so the user
  // waits a few seconds and lands on a dashboard that is already sorted.
  const classification = overDailyCap
    ? null
    : await classifyDocument({
        buffer: fileBuffer,
        mimeType: file.type,
        fileName: file.name,
      });

  // Proposed fields go through their category's schema before touching the
  // database (PROJECT_PLAN B3). A guessed category whose fields fail validation
  // keeps the category but waits for a human.
  const narrowed = classification
    ? narrowSubtypeFields(classification.category, classification.subtypeFields)
    : null;

  const category = classification?.category ?? "OTHER";
  const extractionStatus = !classification
    ? ExtractionStatus.PENDING
    : narrowed?.ok
      ? extractionStatusFor(classification)
      : ExtractionStatus.NEEDS_REVIEW;

  // Base row and typed row in one transaction: a document must never exist with
  // half its data. The switch that picks the table lives in subtypes.ts.
  await prisma.$transaction(async (tx) => {
    const document = await tx.document.create({
      data: {
        ownerId: user.id,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        fileData: fileBuffer,
        fileHash: fileHash,
        category,
        extractionStatus,
        deadlineType: classification?.deadlineType ?? null,
        // A date-only string from the model: pinned to UTC midnight so the same
        // document never lands on a different day depending on the server.
        targetDate: classification?.targetDate
          ? new Date(`${classification.targetDate}T00:00:00Z`)
          : null,
      },
    });

    if (narrowed?.ok && narrowed.model && narrowed.data) {
      await writeSubtypeRow(tx, narrowed.model, document.id, narrowed.data);
    }
  });

  redirect("/");
}
