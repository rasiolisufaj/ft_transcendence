import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { isChannelMember } from "@/realtime/membership";

let userId: string;
let channelId: number;

beforeEach(async () => {
  const user = await prisma.user.create({
    data: { email: `test-${randomUUID()}@mespapiers.test`, displayName: "Alice" },
  });
  const channel = await prisma.channel.create({ data: { title: `test-${randomUUID()}` } });
  userId = user.id;
  channelId = channel.id;
});

afterEach(async () => {
  await prisma.channel.delete({ where: { id: channelId } });
  await prisma.user.delete({ where: { id: userId } });
});

describe("isChannelMember", () => {
  it("is true for a member of the channel", async () => {
    await prisma.channelMember.create({ data: { channelId, userId } });

    expect(await isChannelMember(userId, channelId)).toBe(true);
  });

  it("is false for someone who has not joined", async () => {
    expect(await isChannelMember(userId, channelId)).toBe(false);
  });

  it("is false for a channel that does not exist", async () => {
    expect(await isChannelMember(userId, 999_999_999)).toBe(false);
  });
});
