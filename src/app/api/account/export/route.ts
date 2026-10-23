import JSZip from "jszip";
import { getTranslations } from "next-intl/server";
import { defaultLocale, isLocale } from "@/i18n/config";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { assertCan } from "@/lib/auth/policy";
import { writeAudit } from "@/lib/audit";
import { sendMail } from "@/lib/mail";

export async function POST(request: Request) {
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
      avatar: true,
    },
  });

  const files = userData?.documents ?? [];

  const zip = new JSZip();
  const dataForJson = {
    ...userData,
    documents: files.map((file) => ({ ...file, fileData: undefined })),
    avatar: userData?.avatar ? { ...userData.avatar, data: undefined } : null,
  };
  zip.file("data.json", JSON.stringify(dataForJson, null, 2));

  for (const file of files) {
    const safeName = file.fileName.replace(/[/\\]/g, "_");
    zip.file(`files/${file.id}-${safeName}`, file.fileData);
  }
  // The profile photo (phase 12); its type is image/png, image/jpeg or image/webp.
  if (userData?.avatar) {
    zip.file(`files/avatar.${userData.avatar.mimeType.split("/")[1]}`, userData.avatar.data);
  }

  // Built before the mail and the audit row, so a failed export reports nothing.
  const zipBytes = await zip.generateAsync({ type: "arraybuffer" });

  // The page sends its locale: API routes have no [locale] segment, and User.locale is never written.
  const requested = String((await request.formData().catch(() => null))?.get("locale"));
  const locale = isLocale(requested) ? requested : defaultLocale;
  const t = await getTranslations({ locale, namespace: "myData" });
  await sendMail(ctx.user.email, t("exportMailSubject"), t("exportMailBody"));

  await writeAudit({
    actorUserId: userId,
    action: "gdpr:export",
    targetType: "User",
    targetId: userId,
  });

  return new Response(zipBytes, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="mes-donnees.zip"',
      "Cache-Control": "private, no-store",
    },
  });
}
