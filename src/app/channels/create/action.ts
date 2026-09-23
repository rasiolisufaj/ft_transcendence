"use server";

import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";

export async function createChannel(formData: FormData) {
  const nameChannel = formData.get("name");
  let descriptionChannel = formData.get("description");

  console.log(nameChannel);
  console.log(descriptionChannel);

  // Check that the channel name is not empty
  // and does not contain only spaces.
  if (typeof nameChannel !== "string" || !nameChannel) {
    return { error: "Merci d'entrer un nom de Channel." };
  }

  const trueNameChannel: string = nameChannel.trim();
  if (trueNameChannel.length === 0) {
    return { error: "Merci d'entrer un nom de Channel." };
  } else if (trueNameChannel.length >= 100) {
    return { error: "Merci d'entrer un nom de Channel moin grand" };
  }

  // Check that the description is a string.
  // Remove spaces at the start and the end.
  // Check if the description is empty.
  // Check that its length is correct.
  // Set hasDescription to true.
  let cleanDescription: string | null = null;

  if (typeof descriptionChannel === "string" && descriptionChannel) {
    const truedescriptionChannel: string = descriptionChannel.trim();
    if (truedescriptionChannel.length === 0) {
      cleanDescription = null;
    } else if (truedescriptionChannel.length >= 251) {
      return { error: "La description est trop longue (250 caractères max)." };
    } else {
      cleanDescription = truedescriptionChannel;
    }
  }

  const user = await prisma.user.findFirst({
    where: { email: "Amir@gmail.com" },
  });
  if (!user) {
    return { error: "user not found" };
  }

  const existingChannel = await prisma.channel.findFirst({
    where: { title: { equals: trueNameChannel, mode: "insensitive" } },
  });
  if (existingChannel) {
    return { error: "Un channel avec ce nom existe déjà." };
  }

  const newChannel = await prisma.channel.create({
    data: {
      createdBy: user.id,
      title: trueNameChannel,
      description: cleanDescription,
      members: {
        create: { userId: user.id, role: "MODERATOR" },
      },
    },
  });
  redirect("/channels");
}

//await prisma.document.create({
//   data: {
//    ownerId: user.id,
//  fileName: file.name,
//  fileType: file.type,
// fileSize: file.size,
//fileData: fileBuffer,
// fileHash: fileHash,
// },
// });
