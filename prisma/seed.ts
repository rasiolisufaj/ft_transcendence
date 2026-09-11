import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";  

const prisma = new PrismaClient() 

async function main ()
{
    const Adrien = await prisma.user.create({
        data:
        {
            email: "Adrien@gmail.com",
            displayName: "Adrien"
        }
    })

    const Alexandre = await prisma.user.create({
        data:
        {
            email: "Alexandre@gmail.com",
            displayName: "Alexandre"
        }
    })

    const Rasiol = await prisma.user.create({
        data:
        {
            email: "Rasiol@gmail.com",
            displayName: "Rasiol"
        }
    })

     const Amir = await prisma.user.create({
        data:
        {
            email: "Amir@gmail.com",
            displayName: "Amir"
        }
    })


    const firstDocument = await prisma.document.create({
        data: {
                    ownerId: Amir.id,
                    fileName: "id-card-amir.png",
                    fileType: "image/png",
                    fileSize: 204800,
                    fileData: Buffer.from("fake image content"),
               },
    });

  const adrienInsuranceDoc = await prisma.document.create({
    data: {
      ownerId: Adrien.id,
      fileName: "assurance-auto-adrien.pdf",
      fileType: "application/pdf",
      fileSize: 152400,
      fileData: Buffer.from("fake pdf content"),
    },
  });

  const channel = await prisma.channel.create({
    data: {
      createdBy: Adrien.id,
      title: "insurance",
      description: "questions about insurance ",
    },
  });

  await prisma.channelMember.createMany({
    data: [
      { channelId: channel.id, userId: Adrien.id, role: "MODERATOR" },
      { channelId: channel.id, userId: Alexandre.id },
      { channelId: channel.id, userId: Rasiol.id },
      { channelId: channel.id, userId: Amir.id },
    ],
  });


  const thread = await prisma.thread.create({
    data: {
      channelId: channel.id,
      userId: Amir.id,
      title: "Which document do I need to insure a car?",
      content: "I just bought a car and they ask me for a carte grise. Is it mandatory?",
    },
  });

  const answer = await prisma.answer.create({
    data: {
      threadId: thread.id,
      userId: Adrien.id,
      content: "Yes, the carte grise is mandatory to insure a vehicle.",
    },
  });

  await prisma.answer.create({
    data: {
      threadId: thread.id,
      userId: Rasiol.id,
      content: "You can also ask for a temporary carte grise while you wait.",
    },
  });

  await prisma.vote.create({
    data: {
      answerId: answer.id,
      userId: Alexandre.id,
      value: 1,
    },
  });
}

main().finally(async () => {
  await prisma.$disconnect();
 // const Message = "ok";
//  console.log(Message); 
});