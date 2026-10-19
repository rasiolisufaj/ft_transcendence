"use server";

import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { prisma } from "@/lib/db";
import { createHash } from "crypto";
import { requireUser } from "@/lib/auth/session";
import { assertCan } from "@/lib/auth/policy";
import { classifyDocument, extractionStatusFor } from "@/lib/documents/classify";
import { narrowSubtypeFields, writeSubtypeRow } from "@/lib/documents/subtypes";
import { ExtractionStatus } from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";

const DAILY_EXTRACTION_CAP = 20;

// Lit les premiers octets et renvoie le vrai MIME, ou null si le type n'est pas accepte.
// On ne fait jamais confiance a file.type.
function sniffMime(fileBuffer: Buffer): string | null {
  // PDF : %PDF
  if (fileBuffer.subarray(0, 4).toString("hex") === "25504446") {
    return "application/pdf";
  }
  // PNG : 89 50 4E 47 0D 0A 1A 0A
  if (fileBuffer.subarray(0, 8).toString("hex") === "89504e470d0a1a0a") {
    return "image/png";
  }
  // JPEG : FF D8 FF
  if (fileBuffer.subarray(0, 3).toString("hex") === "ffd8ff") {
    return "image/jpeg";
  }
  // WEBP : "RIFF" .... "WEBP"
  if (
    fileBuffer.length >= 12 &&
    fileBuffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    fileBuffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export async function uploadDocument(formData: FormData): Promise<void> {
  const ctx = await requireUser();
  assertCan(ctx, "document:create");
  const { user } = ctx;

  const file = formData.get("file");

  // 1. verifie qu'il y a bien un fichier
  if (!(file instanceof File) || file.size === 0) {
    return;
  }

  // 2. verifie la taille (10 Mo)
  if (file.size > 10 * 1024 * 1024) {
    return;
  }

  const fileBuffer = Buffer.from(await file.arrayBuffer());

  // 3. le vrai type est determine par les magic bytes, pas par file.type
  const trueMime = sniffMime(fileBuffer);
  if (!trueMime) {
    return;
  }

  // 4. empreinte du contenu pour la deduplication (par user)
  const fileHash = createHash("sha256").update(fileBuffer).digest("hex");

  // 5. plafond jour par jour : passe le cap on garde le document, mais non classe
  const uploadsToday = await prisma.document.count({
    where: {
      ownerId: user.id,
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  });
  const overDailyCap = uploadsToday >= DAILY_EXTRACTION_CAP;

  // 6. classification IA (optionnelle)
  const classification = overDailyCap
    ? null
    : await classifyDocument({
        buffer: fileBuffer,
        mimeType: trueMime,
        fileName: file.name,
      });

  const narrowed = classification
    ? narrowSubtypeFields(classification.category, classification.subtypeFields)
    : null;

  const category = classification?.category ?? "OTHER";
  const extractionStatus = !classification
    ? ExtractionStatus.PENDING
    : narrowed?.ok
      ? extractionStatusFor(classification)
      : ExtractionStatus.NEEDS_REVIEW;

  // 7. ecriture : la contrainte unique [ownerId, fileHash] attrape le doublon
  try {
    await prisma.$transaction(async (tx) => {
      const document = await tx.document.create({
        data: {
          ownerId: user.id,
          fileName: file.name,
          fileType: trueMime,
          fileSize: file.size,
          fileData: fileBuffer,
          fileHash: fileHash,
          category,
          extractionStatus,
          deadlineType: classification?.deadlineType ?? null,
          targetDate: classification?.targetDate
            ? new Date(`${classification.targetDate}T00:00:00Z`)
            : null,
        },
      });

      if (narrowed?.ok && narrowed.model && narrowed.data) {
        await writeSubtypeRow(tx, narrowed.model, document.id, narrowed.data);
      }
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return;
    }
    throw error;
  }

  return redirect({ href: "/", locale: await getLocale() });
}
