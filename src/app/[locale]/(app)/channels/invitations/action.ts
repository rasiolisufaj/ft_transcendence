"use server"

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";



export async function acceptInvite(formData:FormData) {
    const idChannel =  formData.get("channelId");

    if (typeof idChannel !== "string" || !idChannel)
        return;
    const trueIdChannel = idChannel.trim();
    if (trueIdChannel.length === 0)
        return;
    const intIdChannel = parseInt(trueIdChannel,10);
    if (isNaN(intIdChannel) || intIdChannel <= 0 || String(intIdChannel) !== trueIdChannel)
        return;
    const channel = await prisma.channel.findFirst({
        where: { id: intIdChannel},
    });
    if(!channel)
        return;

    const { user } = await requireUser();
    const checkInvitations = await prisma.channelInvite.findFirst({
     where : {channelId : channel.id,userId : user.id},
    });
    if(!checkInvitations)
         return;

    // verifier que le membre nest pas deja dans le channel
    const userMember = await prisma.channelMember.findFirst({
        where : {userId: user.id, channelId : channel.id},
    });
    if(userMember)
    {
       await prisma.channelInvite.deleteMany({
            where : {channelId : channel.id, userId : user.id},
        });
        return;
    }

   await prisma.channelMember.create({
    data: { channelId: channel.id, userId: user.id },
    });
     await prisma.channelInvite.deleteMany({
            where : {channelId : channel.id, userId : user.id},
        });
    revalidatePath("/channels/invitations");

}

export async function declineInvite(formData: FormData) {
  const idChannel = formData.get("channelId");

  if (typeof idChannel !== "string" || !idChannel)
    return;

  const trueIdChannel = idChannel.trim();
  const intIdChannel = parseInt(trueIdChannel, 10);
  if (Number.isNaN(intIdChannel) || intIdChannel <= 0 || String(intIdChannel) !== trueIdChannel)
    return;

  const { user } = await requireUser();

  const invitation = await prisma.channelInvite.findFirst({
    where: { channelId: intIdChannel, userId: user.id },
  });
  if (!invitation)
    return;

  await prisma.channelInvite.deleteMany({
    where: { channelId: intIdChannel, userId: user.id },
  });

  revalidatePath("/channels/invitations");
}
