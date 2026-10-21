import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GlobalRole } from "@/generated/prisma/client";
import { ForbiddenError } from "@/lib/auth/policy";
import { createSession, requireUser, validateSessionToken } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { kickMembers, setChannelRole } from "./[id]/kick/action";
import { acceptJoinRequest, rejectJoinRequest } from "./[id]/requests/action";
import { inviteUser } from "./[id]/invite/action";
import { editChannel } from "./[id]/edit/action";
import { deleteChannel } from "./[id]/delete/action";
import { createAnswer, deleteAnswer, leaveChannel, modifAnswerUser } from "./[id]/actions";
import { redirect } from "@/i18n/navigation";

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
  prisma.auditLog.findMany({ where: { channelId } });

afterEach(async () => {
  // Audit rows first: their channel FK is onDelete:SetNull, so we delete them
  // explicitly here before the channel disappears.
  await prisma.auditLog.deleteMany({ where: { channelId: { in: created.channels } } });
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

describe("editing and deleting a channel", () => {
  const editForm = (channelId: number, questionId: number) =>
    form({ channelId, questionId, name: "Nouveau titre", description: "Nouvelle description", question: "Nouvelle question" });

  it("refuses a plain member's edit; a moderator who is not the creator edits, audited", async () => {
    const creator = await newUser();
    const mod = await newUser();
    const member = await newUser();
    const a = await newChannel({ [creator.id]: "MODERATOR", [mod.id]: "MODERATOR", [member.id]: "MEMBER" }, creator.id);

    await signInAs(member.id);
    await expect(editChannel(editForm(a.id, a.threadId))).rejects.toBeInstanceOf(ForbiddenError);
    expect((await prisma.channel.findUnique({ where: { id: a.id } }))?.title).not.toBe("Nouveau titre");

    await signInAs(mod.id);
    await editChannel(editForm(a.id, a.threadId));

    expect((await prisma.channel.findUnique({ where: { id: a.id } }))?.title).toBe("Nouveau titre");
    expect(await auditRows(a.id)).toEqual([
      expect.objectContaining({ actorUserId: mod.id, action: "channel:update", targetType: "Channel", targetId: String(a.id) }),
    ]);
  });

  it("sends a non-member admin back to /channels after an edit, a member to the channel", async () => {
    const admin = await newUser("ADMIN");
    const creator = await newUser();
    const c = await newChannel({ [creator.id]: "MODERATOR" }, creator.id);

    await signInAs(admin.id);
    await editChannel(editForm(c.id, c.threadId));
    // The channel page 404s for a non-member, so sending the admin there would look like a failure.
    expect(vi.mocked(redirect)).toHaveBeenLastCalledWith({ href: "/channels", locale: "fr" });

    await signInAs(creator.id);
    await editChannel(editForm(c.id, c.threadId));
    expect(vi.mocked(redirect)).toHaveBeenLastCalledWith({ href: `/channels/${c.id}`, locale: "fr" });
  });

  it("refuses a delete by a moderator who is not the creator", async () => {
    const creator = await newUser();
    const mod = await newUser();
    const c = await newChannel({ [creator.id]: "MODERATOR", [mod.id]: "MODERATOR" }, creator.id);
    await signInAs(mod.id);

    await expect(deleteChannel(form({ deletechannel: c.id }))).rejects.toBeInstanceOf(ForbiddenError);

    expect(await prisma.channel.findUnique({ where: { id: c.id } })).not.toBeNull();
    expect(await auditRows(c.id)).toEqual([]);
  });

  it("lets the creator delete the channel, audited once, after the delete", async () => {
    const creator = await newUser();
    const c = await newChannel({ [creator.id]: "MODERATOR" }, creator.id);
    await signInAs(creator.id);

    await deleteChannel(form({ deletechannel: c.id }));
    await expect(deleteChannel(form({ deletechannel: c.id }))).resolves.toBeUndefined();   // a double click

    expect(await prisma.channel.findUnique({ where: { id: c.id } })).toBeNull();
    // AuditLog.channelId is a FK with onDelete:SetNull, so after the delete
    // the audit row survives with channelId NULL. targetId still carries the id.
    const rows = await prisma.auditLog.findMany({
      where: { targetType: "Channel", targetId: String(c.id), action: "channel:delete" },
    });
    expect(rows).toEqual([
      expect.objectContaining({ actorUserId: creator.id, action: "channel:delete", targetType: "Channel", targetId: String(c.id) }),
    ]);
    // Nettoyage : la ligne d'audit n'a plus de channelId, donc l'afterEach ne la ciblera pas.
    await prisma.auditLog.deleteMany({ where: { targetType: "Channel", targetId: String(c.id) } });
  });
});

describe("answers", () => {
  const newAnswer = async (threadId: number, userId: string) =>
    prisma.answer.create({ data: { threadId, userId, content: "Réponse" } });

  it("refuses a plain member's delete of another answer; a moderator's delete is audited, an author's own is not", async () => {
    const mod = await newUser();
    const author = await newUser();
    const member = await newUser();
    const a = await newChannel({ [mod.id]: "MODERATOR", [author.id]: "MEMBER", [member.id]: "MEMBER" }, mod.id);
    const a1 = await newAnswer(a.threadId, author.id);
    const a2 = await newAnswer(a.threadId, author.id);

    await signInAs(member.id);
    await expect(deleteAnswer(form({ answerId: a1.id }))).rejects.toBeInstanceOf(ForbiddenError);

    await signInAs(mod.id);
    await deleteAnswer(form({ answerId: a1.id }));

    await signInAs(author.id);
    await deleteAnswer(form({ answerId: a2.id }));

    expect(await prisma.answer.count({ where: { id: { in: [a1.id, a2.id] } } })).toBe(0);
    expect(await auditRows(a.id)).toEqual([
      expect.objectContaining({ actorUserId: mod.id, action: "answer:delete", targetType: "Answer", targetId: String(a1.id) }),
    ]);
  });

  it("refuses an answer from a non-member, and an edit of someone else's answer", async () => {
    const mod = await newUser();
    const author = await newUser();
    const stranger = await newUser();
    const c = await newChannel({ [mod.id]: "MODERATOR", [author.id]: "MEMBER" }, mod.id);
    const a1 = await newAnswer(c.threadId, author.id);

    await signInAs(stranger.id);
    await expect(createAnswer(form({ threadId: c.threadId, content: "Intrus" }))).rejects.toBeInstanceOf(ForbiddenError);

    await signInAs(mod.id);
    await expect(modifAnswerUser(form({ answerId: a1.id, channelId: c.id, content: "Réécrit" }))).rejects.toBeInstanceOf(ForbiddenError);

    expect(await prisma.answer.count({ where: { threadId: c.threadId } })).toBe(1);
    expect((await prisma.answer.findUnique({ where: { id: a1.id } }))?.content).toBe("Réponse");
  });

  it("audits an admin's rewrite of someone else's answer and sends the non-member admin to /channels; an author's own edit is not audited", async () => {
    const admin = await newUser("ADMIN");
    const mod = await newUser();
    const author = await newUser();
    const c = await newChannel({ [mod.id]: "MODERATOR", [author.id]: "MEMBER" }, mod.id);
    const a1 = await newAnswer(c.threadId, author.id);

    await signInAs(admin.id);
    await modifAnswerUser(form({ answerId: a1.id, channelId: c.id, content: "Corrigé" }));
    expect(vi.mocked(redirect)).toHaveBeenLastCalledWith({ href: "/channels", locale: "fr" });

    await signInAs(author.id);
    await modifAnswerUser(form({ answerId: a1.id, channelId: c.id, content: "Ma version" }));
    expect(vi.mocked(redirect)).toHaveBeenLastCalledWith({ href: `/channels/${c.id}`, locale: "fr" });

    expect((await prisma.answer.findUnique({ where: { id: a1.id } }))?.content).toBe("Ma version");
    expect(await auditRows(c.id)).toEqual([
      expect.objectContaining({ actorUserId: admin.id, action: "answer:update", targetType: "Answer", targetId: String(a1.id) }),
    ]);
  });
});

describe("channel roles (channel:manageRoles)", () => {
  const roleOf = async (channelId: number, userId: string) =>
    (await prisma.channelMember.findUnique({ where: { channelId_userId: { channelId, userId } } }))?.role;

  it("refuses a moderator, even in their own channel, and changes nothing", async () => {
    const mod = await newUser();
    const member = await newUser();
    const c = await newChannel({ [mod.id]: "MODERATOR", [member.id]: "MEMBER" }, mod.id);
    await signInAs(mod.id);

    await expect(setChannelRole(form({ channelId: c.id, userId: member.id, role: "MODERATOR" })))
      .rejects.toBeInstanceOf(ForbiddenError);

    expect(await roleOf(c.id, member.id)).toBe("MEMBER");
    expect(await auditRows(c.id)).toEqual([]);
  });

  it("lets an admin who is not a member promote, once, audited; the member's existing session kicks on its next request", async () => {
    const admin = await newUser("ADMIN");
    const creator = await newUser();
    const member = await newUser();
    const other = await newUser();
    const outsider = await newUser();
    const c = await newChannel({ [creator.id]: "MODERATOR", [member.id]: "MEMBER", [other.id]: "MEMBER" }, creator.id);
    const { token } = await createSession(member.id);   // the member was signed in before the promote
    await signInAs(admin.id);

    // Forged forms: a role that is not a ChannelRole, a user who is not a member.
    await setChannelRole(form({ channelId: c.id, userId: member.id, role: "ADMIN" }));
    await setChannelRole(form({ channelId: c.id, userId: outsider.id, role: "MODERATOR" }));
    expect(await roleOf(c.id, member.id)).toBe("MEMBER");
    expect(await isMember(c.id, outsider.id)).toBe(false);

    await setChannelRole(form({ channelId: c.id, userId: member.id, role: "MODERATOR" }));
    await setChannelRole(form({ channelId: c.id, userId: member.id, role: "MODERATOR" }));   // a double click

    expect(await roleOf(c.id, member.id)).toBe("MODERATOR");
    expect(await auditRows(c.id)).toEqual([
      expect.objectContaining({
        actorUserId: admin.id, action: "channel:setRole", targetType: "User", targetId: member.id,
        metadata: { role: "MODERATOR" },
      }),
    ]);

    // No session was invalidated: the member's next request re-reads the memberships.
    vi.mocked(requireUser).mockResolvedValue((await validateSessionToken(token))!);
    await kickMembers(form({ channelId: c.id, userId: other.id }));
    expect(await isMember(c.id, other.id)).toBe(false);
  });

  it("lets an admin demote a channel's last moderator (§C-20), who can then no longer kick or delete", async () => {
    const admin = await newUser("ADMIN");
    const creator = await newUser();
    const member = await newUser();
    const c = await newChannel({ [creator.id]: "MODERATOR", [member.id]: "MEMBER" }, creator.id);
    await signInAs(admin.id);

    await setChannelRole(form({ channelId: c.id, userId: creator.id, role: "MEMBER" }));

    expect(await roleOf(c.id, creator.id)).toBe("MEMBER");
    expect(await auditRows(c.id)).toEqual([
      expect.objectContaining({ actorUserId: admin.id, action: "channel:setRole", targetId: creator.id, metadata: { role: "MEMBER" } }),
    ]);

    await signInAs(creator.id);
    await expect(kickMembers(form({ channelId: c.id, userId: member.id }))).rejects.toBeInstanceOf(ForbiddenError);
    expect(await isMember(c.id, member.id)).toBe(true);
    // The creator, but no longer a moderator.
    await expect(deleteChannel(form({ deletechannel: c.id }))).rejects.toBeInstanceOf(ForbiddenError);
    expect(await prisma.channel.findUnique({ where: { id: c.id } })).not.toBeNull();
  });
});

describe("leaving a channel", () => {
  it("lets a moderator leave, the creator included (vision §3: a moderator can do everything a member can)", async () => {
    const creator = await newUser();
    const appointed = await newUser();
    const c = await newChannel({ [creator.id]: "MODERATOR", [appointed.id]: "MODERATOR" }, creator.id);

    await signInAs(appointed.id);
    await leaveChannel(form({ channelId: c.id }));
    await signInAs(creator.id);
    await leaveChannel(form({ channelId: c.id }));

    expect(await isMember(c.id, appointed.id)).toBe(false);
    expect(await isMember(c.id, creator.id)).toBe(false);   // §C-19/§C-20: a channel may be left with no moderator
  });

  it("takes channel:delete away from a creator who left (§C-20)", async () => {
    const creator = await newUser();
    const c = await newChannel({ [creator.id]: "MODERATOR" }, creator.id);
    await signInAs(creator.id);
    await leaveChannel(form({ channelId: c.id }));

    await signInAs(creator.id);   // the next request reads the memberships again
    await expect(deleteChannel(form({ deletechannel: c.id }))).rejects.toBeInstanceOf(ForbiddenError);
    expect(await prisma.channel.findUnique({ where: { id: c.id } })).not.toBeNull();
  });
});
