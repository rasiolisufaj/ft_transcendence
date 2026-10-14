import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GlobalRole } from "@/generated/prisma/client";
import { ForbiddenError } from "@/lib/auth/policy";
import { createSession, requireUser, validateSessionToken } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { kickMembers } from "./[id]/kick/action";
import { acceptJoinRequest, rejectJoinRequest } from "./[id]/requests/action";
import { inviteUser } from "./[id]/invite/action";

// requireUser() reads the cookie, and revalidatePath(), getLocale() and the localised
// redirect() need a Next request, so the four are replaced. The context the actions
// get is still real: loaded from a real Session row, memberships included.
vi.mock("@/lib/auth/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/session")>()),
  requireUser: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next-intl/server", () => ({ getLocale: vi.fn(async () => "fr") }));
vi.mock("@/i18n/navigation", () => ({ redirect: vi.fn() }));

type Role = "MEMBER" | "MODERATOR";
let created: { users: string[]; channels: number[] } = { users: [], channels: [] };

async function newUser(globalRole: GlobalRole = "USER") {
  const user = await prisma.user.create({
    data: { email: `test-${randomUUID()}@mespapiers.test`, displayName: "Test", globalRole },
  });
  created.users.push(user.id);
  return user;
}

// A channel and its one question, as createChannel makes them. createdBy is null
// when the creator was deleted (§C-19), and need not be one of the moderators.
async function newChannel(members: Record<string, Role>, createdBy: string | null = null) {
  const channel = await prisma.channel.create({
    data: {
      title: `test-${randomUUID()}`,
      createdBy,
      members: { create: Object.entries(members).map(([userId, role]) => ({ userId, role })) },
      threads: { create: { title: "Question", content: "Question", userId: createdBy } },
    },
    include: { threads: true },
  });
  created.channels.push(channel.id);
  return { id: channel.id, threadId: channel.threads[0]!.id };
}

// Call it AFTER creating the channels: the context's memberships are read here, once,
// exactly as requireUser() reads them once per request.
async function signInAs(userId: string) {
  const { token } = await createSession(userId);
  vi.mocked(requireUser).mockResolvedValue((await validateSessionToken(token))!);
}

function form(fields: Record<string, string | number>): FormData {
  const f = new FormData();
  for (const [name, value] of Object.entries(fields)) f.set(name, String(value));
  return f;
}

const isMember = async (channelId: number, userId: string) =>
  (await prisma.channelMember.count({ where: { channelId, userId } })) === 1;
const auditRows = (channelId: number) =>
  prisma.auditLog.findMany({ where: { channelId: String(channelId) } });

afterEach(async () => {
  // Audit rows first: their channelId is a plain string, so no cascade reaches them.
  await prisma.auditLog.deleteMany({ where: { channelId: { in: created.channels.map(String) } } });
  // Cascades members, threads, answers, invites and join requests.
  await prisma.channel.deleteMany({ where: { id: { in: created.channels } } });
  await prisma.user.deleteMany({ where: { id: { in: created.users } } });
  created = { users: [], channels: [] };
});

describe("moderation actions (channel:moderate)", () => {
  it("refuses a plain member on every moderation action, and changes nothing", async () => {
    const mod = await newUser();
    const member = await newUser();
    const other = await newUser();
    const applicant = await newUser();
    const outsider = await newUser();
    const c = await newChannel({ [mod.id]: "MODERATOR", [member.id]: "MEMBER", [other.id]: "MEMBER" }, mod.id);
    await prisma.channelJoinRequest.create({ data: { channelId: c.id, userId: applicant.id } });
    await signInAs(member.id);

    await expect(kickMembers(form({ channelId: c.id, userId: other.id }))).rejects.toBeInstanceOf(ForbiddenError);
    await expect(acceptJoinRequest(form({ channelId: c.id, userId: applicant.id }))).rejects.toBeInstanceOf(ForbiddenError);
    await expect(rejectJoinRequest(form({ channelId: c.id, userId: applicant.id }))).rejects.toBeInstanceOf(ForbiddenError);
    await expect(inviteUser(form({ channelId: c.id, userId: outsider.id }))).rejects.toBeInstanceOf(ForbiddenError);

    expect(await isMember(c.id, other.id)).toBe(true);
    expect(await isMember(c.id, applicant.id)).toBe(false);
    expect(await prisma.channelJoinRequest.count({ where: { channelId: c.id } })).toBe(1);
    expect(await prisma.channelInvite.count({ where: { channelId: c.id } })).toBe(0);
    expect(await auditRows(c.id)).toEqual([]);
  });

  it("refuses a moderator of one channel who replays a kick with another channel's id", async () => {
    const modA = await newUser();
    const modB = await newUser();
    const member = await newUser();
    await newChannel({ [modA.id]: "MODERATOR" }, modA.id);
    const b = await newChannel({ [modB.id]: "MODERATOR", [member.id]: "MEMBER" }, modB.id);
    await signInAs(modA.id);

    await expect(kickMembers(form({ channelId: b.id, userId: member.id }))).rejects.toBeInstanceOf(ForbiddenError);

    expect(await isMember(b.id, member.id)).toBe(true);
    expect(await auditRows(b.id)).toEqual([]);
  });

  it("lets an admin who is not a member kick in a channel with no moderator, once, audited", async () => {
    const admin = await newUser("ADMIN");
    const member = await newUser();
    const c = await newChannel({ [member.id]: "MEMBER" });   // §C-19: its only moderator was deleted
    await signInAs(admin.id);

    await kickMembers(form({ channelId: c.id, userId: member.id }));
    await kickMembers(form({ channelId: c.id, userId: member.id }));   // a double click

    expect(await isMember(c.id, member.id)).toBe(false);
    expect(await auditRows(c.id)).toEqual([
      expect.objectContaining({ actorUserId: admin.id, action: "channel:kick", targetType: "User", targetId: member.id }),
    ]);
  });

  it("audits accepting and rejecting a join request, and an invite", async () => {
    const mod = await newUser();
    const alice = await newUser();
    const bob = await newUser();
    const carol = await newUser();
    const c = await newChannel({ [mod.id]: "MODERATOR" }, mod.id);
    await prisma.channelJoinRequest.createMany({
      data: [{ channelId: c.id, userId: alice.id }, { channelId: c.id, userId: bob.id }],
    });
    await signInAs(mod.id);

    await acceptJoinRequest(form({ channelId: c.id, userId: alice.id }));
    await rejectJoinRequest(form({ channelId: c.id, userId: bob.id }));
    await inviteUser(form({ channelId: c.id, userId: carol.id }));

    expect(await isMember(c.id, alice.id)).toBe(true);
    expect(await isMember(c.id, bob.id)).toBe(false);
    expect(await prisma.channelInvite.count({ where: { channelId: c.id, userId: carol.id } })).toBe(1);
    const rows = await auditRows(c.id);
    expect(rows).toHaveLength(3);
    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ actorUserId: mod.id, action: "channel:acceptRequest", targetType: "User", targetId: alice.id }),
      expect.objectContaining({ actorUserId: mod.id, action: "channel:rejectRequest", targetType: "User", targetId: bob.id }),
      expect.objectContaining({ actorUserId: mod.id, action: "channel:invite", targetType: "User", targetId: carol.id }),
    ]));
  });
});
