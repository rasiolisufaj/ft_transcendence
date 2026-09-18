"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

export async function uploadDocument(formData: FormData) {
  const file = formData.get("file") as File; // stocke le fichier
  if (!file) // cjeck if file is not empty
  {
    throw new Error("fichier vide");
  }
  if (file.size > 10 * 1024 * 1024) // check if file is not to more
  {
    throw new Error("fichier superieur a 10 mo");
  }
  const fileType = file.type; // verifie le type du fichier
  if (
    fileType != "image/png" &&
    fileType != "image/jpeg" &&
    fileType != "application/pdf"
  ) {
    throw new Error("on ne prend pas en chrge ce type de fichier");
  }
  const buffer = Buffer.from(await file.arrayBuffer()); // lit les octets du fichier et les range dan la variable buffer
  // va chercher le user amir dans la db
  const user = await prisma.user.findFirst({
    where: { email: "Amir@gmail.com" },
  });
  if (!user) {
    throw new Error("Utilisateur introuvable");
  }
  await prisma.document.create({
    data: {
      ownerId: user.id,
      fileName: file.name,
      fileType: fileType,
      fileSize: file.size,
      fileData: buffer,
    },
  });
  redirect("/");
}
