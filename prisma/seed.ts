import "dotenv/config";
import { PrismaClient, type User } from "../src/generated/prisma/client";

const prisma = new PrismaClient();

// Crée un channel avec son créateur (MODERATOR), ses membres (MEMBER) et sa question
async function createChannel(
    creator: User,
    title: string,
    description: string,
    question: string,
    details: string,
    members: User[]
)
{
    const channel = await prisma.channel.create({
        data: { createdBy: creator.id, title, description },
    });

    await prisma.channelMember.createMany({
        data: [
            { channelId: channel.id, userId: creator.id, role: "MODERATOR" },
            ...members.map((member) => ({ channelId: channel.id, userId: member.id })),
        ],
    });

    const thread = await prisma.thread.create({
        data: { channelId: channel.id, userId: creator.id, title: question, content: details },
    });

    return { channel, thread };
}

async function main()
{
    // 1. Les 10 utilisateurs
    // Amir garde "Amir@gmail.com" : le code utilise cet email en dur pour l'instant
    const names = ["Amir", "Adrien", "Rasiol", "Syu", "Alexandre", "Lina", "Yanis", "Sarah", "Karim", "Emma"];
    const users: User[] = [];

    for (const name of names)
    {
        const user = await prisma.user.create({
            data: { email: `${name}@gmail.com`, displayName: name },
        });
        users.push(user);
    }

    const [Amir, Adrien, Rasiol, Syu, Alexandre, Lina, Yanis, Sarah, Karim, Emma] = users;

    // 2. Les 5 channels (chaque utilisateur est dans au moins un channel)
    const auto = await createChannel(
        Amir,
        "Assurance auto",
        "Questions sur l'assurance voiture",
        "Quels papiers pour assurer ma voiture ?",
        "Je viens d'acheter une voiture. L'assureur me demande la carte grise. C'est obligatoire ?",
        [Adrien, Lina, Karim]
    );

    const sejour = await createChannel(
        Adrien,
        "Titre de séjour",
        "Demande et renouvellement du titre de séjour",
        "Quand renouveler mon titre de séjour ?",
        "Mon titre de séjour expire dans 3 mois. Quand dois-je faire la demande ?",
        [Rasiol, Yanis, Sarah]
    );

    await createChannel(
        Rasiol,
        "CAF",
        "Aides au logement et démarches CAF",
        "Comment déclarer un changement d'adresse à la CAF ?",
        "Je viens de déménager. Je dois prévenir la CAF en ligne ou par courrier ?",
        [Syu, Emma, Amir]
    );

    const identite = await createChannel(
        Syu,
        "Carte d'identité",
        "Faire ou refaire sa carte d'identité",
        "Carte d'identité perdue : que faire ?",
        "J'ai perdu ma carte d'identité. Je dois faire une déclaration de perte avant de la refaire ?",
        [Alexandre, Lina]
    );

    const impots = await createChannel(
        Alexandre,
        "Impôts",
        "Déclaration de revenus et impôts",
        "Je dois déclarer mes revenus en tant qu'étudiant ?",
        "C'est ma première année seul. Je dois faire une déclaration même si je gagne peu ?",
        [Karim, Emma, Yanis, Sarah]
    );

    // 3. Deux réponses et un vote dans "Assurance auto" (pour tester les réponses et les votes)
    const answer = await prisma.answer.create({
        data: {
            threadId: auto.thread.id,
            userId: Adrien.id,
            content: "Oui, la carte grise est obligatoire pour assurer une voiture.",
        },
    });

    await prisma.answer.create({
        data: {
            threadId: auto.thread.id,
            userId: Karim.id,
            content: "En attendant la carte grise, tu peux donner le certificat provisoire.",
        },
    });

    await prisma.vote.create({
        data: { answerId: answer.id, userId: Lina.id, value: 1 },
    });

    // 4. Les invitations (chaque invité n'est pas encore membre du channel)
    // Amir en reçoit 2 pour tester "Accepter" et "Refuser"
    await prisma.channelInvite.createMany({
        data: [
            { channelId: sejour.channel.id, userId: Amir.id },
            { channelId: impots.channel.id, userId: Amir.id },
            { channelId: auto.channel.id, userId: Sarah.id },
            { channelId: identite.channel.id, userId: Emma.id },
        ],
    });

    console.log("Seed terminé : 10 utilisateurs, 5 channels, 4 invitations");
}

main()
    .catch((error) => {
        console.error(error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });