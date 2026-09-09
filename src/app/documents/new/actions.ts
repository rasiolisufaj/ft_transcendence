"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import type { DocumentCategory, DeadlineType } from "@/generated/prisma/client";

export async function createDocument(formData: FormData) {
  const category = formData.get("category") as DocumentCategory;
  const title = formData.get("title") as string;
  const issuingAuthority = (formData.get("issuingAuthority") as string) || null;
  const issueDateRaw = formData.get("issueDate") as string;
  const targetDateRaw = formData.get("targetDate") as string;

  if (!title || !category) {
    throw new Error("Title and category are required");
  }

  const deadlineType: DeadlineType =
    category === "IDENTITY" ? "HARD" : "SOFT";

  // TODO: replace with real authenticated user once auth is built
  let user = await prisma.user.findFirst();
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: "demo@mespapiers.local",
        displayName: "Demo User",
      },
    });
  }

  const doc = await prisma.document.create({
    data: {
      ownerId: user.id,
      category,
      deadlineType,
      title,
      issuingAuthority,
      issueDate: issueDateRaw ? new Date(issueDateRaw) : null,
      targetDate: targetDateRaw ? new Date(targetDateRaw) : null,
    },
  });

  // Create the subtype row
  if (category === "IDENTITY") {
    await prisma.documentIdentity.create({
      data: {
        id: doc.id,
        holderName: (formData.get("holderName") as string) || null,
        documentNumber: (formData.get("documentNumber") as string) || null,
        nationality: (formData.get("nationality") as string) || null,
      },
    });
  } else if (category === "INSURANCE") {
    const premiumRaw = formData.get("premiumPerYear") as string;
    const anniversaryRaw = formData.get("anniversaryDate") as string;
    await prisma.documentInsurance.create({
      data: {
        id: doc.id,
        insurer: (formData.get("insurer") as string) || null,
        policyNumber: (formData.get("policyNumber") as string) || null,
        premiumPerYear: premiumRaw ? parseFloat(premiumRaw) : null,
        coverageType: (formData.get("coverageType") as string) || null,
        anniversaryDate: anniversaryRaw ? new Date(anniversaryRaw) : null,
      },
    });
  }

  redirect("/");
}
