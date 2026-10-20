import JSZip from "jszip";
import { getTranslations } from "next-intl/server";
import { defaultLocale, isLocale } from "@/i18n/config";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { assertCan } from "@/lib/auth/policy";
import { writeAudit } from "@/lib/audit";
import { sendMail } from "@/lib/mail";

export async function POST() {
  const ctx = await getCurrentUser();
  if (!ctx) {
    return new Response(null, { status: 401 });
  }

  assertCan(ctx, "gdpr:export");
  const userId = ctx.user.id;

  const userData = await prisma.user.findUnique({
    where: { id: userId },
    omit: {
      passwordHash: true,
      totpSecret: true,
    },
    include: {
      documents: { include: { identity: true, insuranceAuto: true } },
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

  const files = userData?.documents ?? [];

  const zip = new JSZip();
  const dataForJson = {
    ...userData,
    documents: files.map((file) => ({ ...file, fileData: undefined })),
  };
  zip.file("data.json", JSON.stringify(dataForJson, null, 2));

  for (const file of files) {
    const safeName = file.fileName.replace(/[/\\]/g, "_");
    zip.file(`files/${file.id}-${safeName}`, file.fileData);
  }

  const locale = isLocale(ctx.user.locale) ? ctx.user.locale : defaultLocale;
  const t = await getTranslations({ locale, namespace: "myData" });
  const date = new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(new Date());
  await sendMail(ctx.user.email, t("exportMailSubject"), t("exportMailBody", { date }));

  await writeAudit({
    actorUserId: userId,
    action: "gdpr:export",
    targetType: "User",
    targetId: userId,
  });

  const nodeStream = zip.generateNodeStream({ type: "nodebuffer", streamFiles: true });

  return new Response(nodeStream as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="mes-donnees.zip"',
      "Cache-Control": "private, no-store",
    },
  });
}
