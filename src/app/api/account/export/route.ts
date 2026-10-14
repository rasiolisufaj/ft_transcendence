import JSZip from "jszip";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { assertCan } from "@/lib/auth/policy";
import { writeAudit } from "@/lib/audit";
import { sendMail } from "@/lib/mail";

export async function GET() {
  //  qui est connecté
  const ctx = await getCurrentUser();
  if (!ctx) {
    return new Response(null, { status: 401 });
  }

  // il a le droit d'exporter ? 
  assertCan(ctx, "gdpr:export");
  const userId = ctx.user.id;

  // toutes les données de l'utilisateur
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
      conversationsAsParticipant1: true,
      conversationsAsParticipant2: true,
      friendshipsSent: true,
      friendshipsReceived: true,
      channelMemberships: true,
      channelInvites: true,
      channelJoinRequests: true,
      oauthAccounts: true,
      notifications: true,
    },
  });

  // les fichiers originaux des documents
  const files = await prisma.document.findMany({
    where: { ownerId: userId },
    select: { id: true, fileName: true, fileData: true },
  });

  // construire le zip 
  const zip = new JSZip();
  zip.file("data.json", JSON.stringify(userData, null, 2));

  for (const file of files) {
    const safeName = file.fileName.replace(/[/\\]/g, "_");
    zip.file(`files/${file.id}-${safeName}`, file.fileData);
  }

  const zipData = await zip.generateAsync({ type: "arraybuffer" });

  // email de confirmation 
  await sendMail(
    ctx.user.email,
    "MesPapiers - Export de vos données",
    `Bonjour,\n\nVos données personnelles ont été exportées le ${new Date().toLocaleString("fr-FR")}.\n\nSi ce n'est pas vous, changez votre mot de passe.\n\nL'équipe MesPapiers`,
  );

  // trace dans le journal d'audit.
  await writeAudit({
    actorUserId: userId,
    action: "gdpr:export",
    targetType: "User",
    targetId: userId,
  });

  // envoyer le ZIP au navigateur.
  return new Response(zipData, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="mes-donnees.zip"',
      "Cache-Control": "private, no-store",
    },
  });
}