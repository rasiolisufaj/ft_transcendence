"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export async function uploadDocument(formData: FormData) {
  const file = formData.get("file") as File | null;

  if (!file || file.size === 0) {
    throw new Error("No file provided");
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error("File too large (max 10 MB)");
  }

  let user = await prisma.user.findFirst();
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: "demo@mespapiers.local",
        displayName: "Demo User",
      },
    });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  await prisma.document.create({
    data: {
      ownerId: user.id,
      fileName: file.name,
      fileType: file.type || "application/octet-stream",
      fileSize: file.size,
      fileData: buffer,
    },
  });

  redirect("/");
}
