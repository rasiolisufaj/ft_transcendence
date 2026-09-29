"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getSeedUser } from "@/lib/auth/seed-user";




export async function kickMembers(formData: FormData)
{
const idChannel = formData.get("channelId");
const iduser = formData.get("userId");


if (typeof idChannel !== "string" || typeof iduser !== "string" || !idChannel || !iduser)
return;

const trueIdChannel = parseInt(idChannel,10);
if(isNaN(trueIdChannel) || trueIdChannel <= 0)
return;
const trueIdUser = iduser.trim();
if (trueIdUser.length === 0)
return;

const user = await getSeedUser();
const moderator = await prisma.channelMember.findFirst({
where : {channelId: trueIdChannel, userId : user.id, role : "MODERATOR"},
});
if(!moderator)
return;

const memberUser = await prisma.channelMember.findFirst({
where : {channelId: trueIdChannel, userId : trueIdUser, role : "MEMBER"},
});
if(!memberUser)
return;

const channel = await prisma.channel.findFirst({
where : {id: trueIdChannel},
});
if(!channel)
return;
await prisma.channelMember.deleteMany({
where: { channelId: trueIdChannel, userId : trueIdUser },
})

revalidatePath(`/channels/${trueIdChannel}/members`);
}