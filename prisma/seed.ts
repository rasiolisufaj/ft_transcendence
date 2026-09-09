import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Create a demo user
  const user = await prisma.user.upsert({
    where: { email: "demo@mespapiers.local" },
    update: {},
    create: {
      email: "demo@mespapiers.local",
      displayName: "Demo User",
    },
  });

  console.log(`Seeded user: ${user.displayName} (${user.id})`);

  // Identity document: Carte d'identite expiring in 45 days
  const idCard = await prisma.document.create({
    data: {
      ownerId: user.id,
      category: "IDENTITY",
      deadlineType: "HARD",
      title: "Carte d'identite",
      issuingAuthority: "Prefecture de Paris",
      issueDate: new Date("2016-03-15"),
      targetDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
      identity: {
        create: {
          holderName: "Demo User",
          documentNumber: "1234567890",
          nationality: "FR",
        },
      },
    },
  });
  console.log(`Seeded: ${idCard.title}`);

  // Home insurance: renewal in 50 days
  const homeInsurance = await prisma.document.create({
    data: {
      ownerId: user.id,
      category: "INSURANCE",
      deadlineType: "SOFT",
      title: "Assurance habitation",
      issuingAuthority: "MAIF",
      issueDate: new Date("2024-01-15"),
      targetDate: new Date(Date.now() + 50 * 24 * 60 * 60 * 1000),
      insurance: {
        create: {
          insurer: "MAIF",
          policyNumber: "HAB-2024-001",
          premiumPerYear: 420.0,
          coverageType: "HOME",
          anniversaryDate: new Date(Date.now() + 50 * 24 * 60 * 60 * 1000),
        },
      },
    },
  });
  console.log(`Seeded: ${homeInsurance.title}`);

  // Car insurance: renewal far away (valid)
  const carInsurance = await prisma.document.create({
    data: {
      ownerId: user.id,
      category: "INSURANCE",
      deadlineType: "SOFT",
      title: "Assurance auto",
      issuingAuthority: "AXA",
      issueDate: new Date("2025-06-01"),
      targetDate: new Date(Date.now() + 200 * 24 * 60 * 60 * 1000),
      insurance: {
        create: {
          insurer: "AXA",
          policyNumber: "AUTO-2025-042",
          premiumPerYear: 680.0,
          coverageType: "CAR",
          anniversaryDate: new Date(Date.now() + 200 * 24 * 60 * 60 * 1000),
        },
      },
    },
  });
  console.log(`Seeded: ${carInsurance.title}`);

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
