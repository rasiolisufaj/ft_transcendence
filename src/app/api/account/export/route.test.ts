import { randomUUID } from "node:crypto";
import JSZip from "jszip";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSession, getCurrentUser, validateSessionToken } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { sendMail } from "@/lib/mail";
import { POST } from "./route";

vi.mock("@/lib/auth/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/session")>()),
  getCurrentUser: vi.fn(),
}));
vi.mock("@/lib/mail", () => ({ sendMail: vi.fn() }));
// next-intl/server needs a request scope; the stub returns which locale and key were asked for.
vi.mock("next-intl/server", () => ({
  getTranslations: async ({ locale, namespace }: { locale: string; namespace: string }) =>
    (key: string) => `${locale}.${namespace}.${key}`,
}));

const PDF = Buffer.from("%PDF-1.4 export test");

function exportRequest(locale: string): Request {
  const body = new FormData();
  body.set("locale", locale);
  return new Request("https://mespapiers.local/api/account/export", { method: "POST", body });
}

describe("POST /api/account/export", () => {
  let user: { id: string; email: string };
  let docId: number;

  beforeEach(async () => {
    user = await prisma.user.create({
      data: { email: `test-${randomUUID()}@mespapiers.test`, displayName: "Test", passwordHash: "x" },
    });
    const doc = await prisma.document.create({
      data: {
        ownerId: user.id,
        fileName: "scan.pdf",
        fileType: "application/pdf",
        fileSize: PDF.length,
        fileData: PDF,
        fileHash: "test",
      },
    });
    docId = doc.id;
    const { token } = await createSession(user.id);
    vi.mocked(getCurrentUser).mockResolvedValue(await validateSessionToken(token));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    await prisma.auditLog.deleteMany({ where: { targetId: user.id } });
    await prisma.user.deleteMany({ where: { id: user.id } });
  });

  it("returns a ZIP of the user's data and original files", async () => {
    const res = await POST(exportRequest("fr"));

    expect(res.status).toBe(200);
    const zip = await JSZip.loadAsync(await res.arrayBuffer());
    const data = JSON.parse(await zip.file("data.json")!.async("string"));
    expect(data.email).toBe(user.email);
    expect(data).not.toHaveProperty("passwordHash");
    expect(await zip.file(`files/${docId}-scan.pdf`)!.async("nodebuffer")).toEqual(PDF);
  });

  it("sends the confirmation mail in the page's locale", async () => {
    await POST(exportRequest("en"));

    expect(sendMail).toHaveBeenCalledExactlyOnceWith(
      user.email,
      "en.myData.exportMailSubject",
      "en.myData.exportMailBody",
    );
  });

  it("neither mails nor audits when the ZIP cannot be built", async () => {
    vi.spyOn(JSZip.prototype, "generateAsync").mockRejectedValue(new Error("zip failed"));

    await expect(POST(exportRequest("fr"))).rejects.toThrow("zip failed");
    expect(sendMail).not.toHaveBeenCalled();
    expect(await prisma.auditLog.findMany({ where: { targetId: user.id } })).toEqual([]);
  });
});
