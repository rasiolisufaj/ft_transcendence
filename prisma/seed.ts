import "dotenv/config";
import {
  PrismaClient,
  type GlobalRole,
  type User,
} from "../src/generated/prisma/client";
import { hashPassword } from "../src/lib/auth/password";

const prisma = new PrismaClient();

// Mot de passe de dev de tous les comptes
const DEV_PASSWORD = "motdepasse123";

// Vide la base dans le bon ordre (les enfants avant les parents).
// Les deleteMany sans where effacent tout.
async function cleanAll() {
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.friendship.deleteMany();
  await prisma.vote.deleteMany();
  await prisma.answer.deleteMany();
  await prisma.thread.deleteMany();
  await prisma.channelJoinRequest.deleteMany();
  await prisma.channelInvite.deleteMany();
  await prisma.channelMember.deleteMany();
  await prisma.channel.deleteMany();
  await prisma.documentIdentity.deleteMany();
  await prisma.documentInsuranceAuto.deleteMany();
  await prisma.document.deleteMany();
  await prisma.oAuthAccount.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
}

// Cree un channel avec son createur (MODERATOR), ses membres (MEMBER) et sa question
async function createChannel(
  creator: User,
  title: string,
  description: string,
  question: string,
  details: string,
  members: User[],
) {
  const channel = await prisma.channel.create({
    data: { createdBy: creator.id, title, description },
  });

  await prisma.channelMember.createMany({
    data: [
      { channelId: channel.id, userId: creator.id, role: "MODERATOR" },
      ...members.map((member) => ({
        channelId: channel.id,
        userId: member.id,
      })),
    ],
  });

  const thread = await prisma.thread.create({
    data: {
      channelId: channel.id,
      userId: creator.id,
      title: question,
      content: details,
    },
  });

  return { channel, thread };
}

// Email en minuscules
async function createUser(name: string, globalRole: GlobalRole = "USER") {
  return prisma.user.create({
    data: {
      email: `${name.toLowerCase()}@gmail.com`,
      displayName: name,
      passwordHash: await hashPassword(DEV_PASSWORD),
      globalRole,
    },
  });
}

async function main() {
  // On nettoie d'abord : la seed est relancable sans erreur de duplicata.
  await cleanAll();

  const Amir = await createUser("Amir");
  const Adrien = await createUser("Adrien");
  const Rasiol = await createUser("Rasiol", "ADMIN");
  const Syu = await createUser("Syu");
  const Alexandre = await createUser("Alexandre");
  const Lina = await createUser("Lina");
  const Yanis = await createUser("Yanis");
  const Sarah = await createUser("Sarah");
  const Karim = await createUser("Karim");
  const Emma = await createUser("Emma");

  // Les 5 channels (chaque utilisateur est dans au moins un channel)
  const auto = await createChannel(
    Amir,
    "Assurance auto",
    "Questions sur l'assurance voiture",
    "Quels papiers pour assurer ma voiture ?",
    "Je viens d'acheter une voiture. L'assureur me demande la carte grise. C'est obligatoire ?",
    [Adrien, Lina, Karim],
  );

  const sejour = await createChannel(
    Adrien,
    "Titre de séjour",
    "Demande et renouvellement du titre de séjour",
    "Quand renouveler mon titre de séjour ?",
    "Mon titre de séjour expire dans 3 mois. Quand dois-je faire la demande ?",
    [Rasiol, Yanis, Sarah],
  );

  await createChannel(
    Rasiol,
    "CAF",
    "Aides au logement et démarches CAF",
    "Comment déclarer un changement d'adresse à la CAF ?",
    "Je viens de déménager. Je dois prévenir la CAF en ligne ou par courrier ?",
    [Syu, Emma, Amir],
  );

  const identite = await createChannel(
    Syu,
    "Carte d'identité",
    "Faire ou refaire sa carte d'identité",
    "Carte d'identité perdue : que faire ?",
    "J'ai perdu ma carte d'identité. Je dois faire une déclaration de perte avant de la refaire ?",
    [Alexandre, Lina],
  );

  const impots = await createChannel(
    Alexandre,
    "Impôts",
    "Déclaration de revenus et impôts",
    "Je dois déclarer mes revenus en tant qu'étudiant ?",
    "C'est ma première année seul. Je dois faire une déclaration même si je gagne peu ?",
    [Karim, Emma, Yanis, Sarah],
  );

  // Deux reponses et un vote dans "Assurance auto"
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
      content:
        "En attendant la carte grise, tu peux donner le certificat provisoire.",
    },
  });

  await prisma.vote.create({
    data: { answerId: answer.id, userId: Lina.id, value: 1 },
  });

  // Les invitations (chaque invite n'est pas encore membre du channel)
  await prisma.channelInvite.createMany({
    data: [
      { channelId: sejour.channel.id, userId: Amir.id },
      { channelId: impots.channel.id, userId: Amir.id },
      { channelId: auto.channel.id, userId: Sarah.id },
      { channelId: identite.channel.id, userId: Emma.id },
    ],
  });

  console.log(
    `Seed termine : 10 utilisateurs (mot de passe "${DEV_PASSWORD}", rasiol@gmail.com est ADMIN), 5 channels, 4 invitations`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
