import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ForbiddenError } from "@/lib/auth/policy";
import { createSession, requireUser, validateSessionToken } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { publish } from "@/lib/realtime/publish";
import { createAnswer, leaveChannel } from "./[id]/actions";
import { kickMembers } from "./[id]/kick/action";

vi.mock("@/lib/auth/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/session")>()),
  requireUser: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next-intl/server", () => ({ getLocale: vi.fn(async () => "fr") }));
vi.mock("@/i18n/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/realtime/publish", () => ({ publish: vi.fn() }));

let created: { users: string[]; channels: number[] } = { users: [], channels: [] };

async function newUser() {
  const user = await prisma.user.create({
    data: { email: `test-${randomUUID()}@mespapiers.test`, displayName: "Test" },
  });
  created.users.push(user.id);
  return user;
}

async function newChannel(members: Record<string, "MEMBER" | "MODERATOR">) {
  const channel = await prisma.channel.create({
    data: {
      title: `test-${randomUUID()}`,
      members: { create: Object.entries(members).map(([userId, role]) => ({ userId, role })) },
      threads: { create: { title: "Question", content: "Question" } },
    },
    include: { threads: true },
  });
  created.channels.push(channel.id);
  return { id: channel.id, threadId: channel.threads[0]!.id };
}

async function signInAs(userId: string) {
  const { token } = await createSession(userId);
  vi.mocked(requireUser).mockResolvedValue((await validateSessionToken(token))!);
}

function form(fields: Record<string, string | number>): FormData {
  const f = new FormData();
  for (const [name, value] of Object.entries(fields)) f.set(name, String(value));
  return f;
}

afterEach(async () => {
  await prisma.auditLog.deleteMany({ where: { channelId: { in: created.channels } } });
  await prisma.channel.deleteMany({ where: { id: { in: created.channels } } });
  await prisma.user.deleteMany({ where: { id: { in: created.users } } });
  created = { users: [], channels: [] };
  vi.mocked(publish).mockReset();
});

describe("answers go out live", () => {
  it("publishes answer.created once the answer is saved", async () => {
    const author = await newUser();
    const c = await newChannel({ [author.id]: "MEMBER" });
    await signInAs(author.id);
    let savedFirst = false;
    vi.mocked(publish).mockImplementation(async () => {
      savedFirst = (await prisma.answer.count({ where: { threadId: c.threadId } })) === 1;
    });

    await createAnswer(form({ threadId: c.threadId, content: "Bonjour" }));

    const answer = await prisma.answer.findFirstOrThrow({ where: { threadId: c.threadId } });
    expect(publish).toHaveBeenCalledWith({
      type: "answer.created",
      channelId: c.id,
      threadId: c.threadId,
      answerId: answer.id,
      actorUserId: author.id,
      at: answer.createdAt.toISOString(),
    });
    expect(savedFirst).toBe(true);
  });

  it("publishes nothing when the answer is refused", async () => {
    const stranger = await newUser();
    const c = await newChannel({});
    await signInAs(stranger.id);

    await expect(createAnswer(form({ threadId: c.threadId, content: "Intrus" }))).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(publish).not.toHaveBeenCalled();
  });
});

describe("member.left goes out live", () => {
  it("is published when a moderator kicks a member", async () => {
    const moderator = await newUser();
    const member = await newUser();
    const c = await newChannel({ [moderator.id]: "MODERATOR", [member.id]: "MEMBER" });
    await signInAs(moderator.id);

    await kickMembers(form({ channelId: c.id, userId: member.id }));

    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: "member.left", channelId: c.id, userId: member.id }),
    );
  });

  it("is published once on a double click", async () => {
    const moderator = await newUser();
    const member = await newUser();
    const c = await newChannel({ [moderator.id]: "MODERATOR", [member.id]: "MEMBER" });
    await signInAs(moderator.id);

    await kickMembers(form({ channelId: c.id, userId: member.id }));
    await kickMembers(form({ channelId: c.id, userId: member.id }));

    expect(publish).toHaveBeenCalledTimes(1);
  });

  it("is published when a member leaves", async () => {
    const member = await newUser();
    const c = await newChannel({ [member.id]: "MEMBER" });
    await signInAs(member.id);

    await leaveChannel(form({ channelId: c.id }));

    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: "member.left", channelId: c.id, userId: member.id }),
    );
  });
});
