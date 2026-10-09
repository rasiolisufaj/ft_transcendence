import JSZip from "jszip";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";

export async function GET() {
  const ctx = await getCurrentUser();
  if (!ctx) {
    return new Response(null, { status: 401 });
  }
  const userId = ctx.user.id;

  const userData = await prisma.user.findUnique({
    where: { id: userId },
    omit: {
      passwordHash: true,
      totpSecret: true,
    },
    include: {
      documents: {
        omit: { fileData: true },
        include: { identity: true, insuranceAuto: true },
      },
      threads: true,
      answers: true,
      votes: true,
      messages: true,
      friendshipsSent: true,
      friendshipsReceived: true,
      channelMemberships: true,
      notifications: true,
    },
  });

  const files = await prisma.document.findMany({
    where: { ownerId: userId },
    select: { id: true, fileName: true, fileData: true },
  });

  const zip = new JSZip();

  zip.file("data.json", JSON.stringify(userData, null, 2));

  for (const file of files) {
    const safeName = file.fileName.replace(/[/\\]/g, "_");
    zip.file(`files/${file.id}-${safeName}`, file.fileData);
  }

  const zipData = await zip.generateAsync({ type: "arraybuffer" });

  return new Response(zipData, {
    headers: {
      "Content-Type": "application/zip", 
      "Content-Disposition": 'attachment; filename="mes-donnees.zip"', 
      "Cache-Control": "private, no-store",
    },
  });
}