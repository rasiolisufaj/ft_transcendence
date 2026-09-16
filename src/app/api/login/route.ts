import { NextResponse } from "next/server"; // fabrique la reponse que on envoie au navigateur
import bcrypt from "bcrypt";
import { prisma } from "@/lib/db";
import { error } from "console";

import { NextResponse } from "next/server";
// import bcrypt from "bcrypt"; // Si tu utilises bcrypt pour hasher tes mots de passe

export async function POST(request: Request) {
  const body = await request.json();
  const email = body.email;
  const password = body.password;

  if (!email || !password) {
    return NextResponse.json({ error: "champs manquants" }, { status: 400 });
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: email },
  });

  if (!existingUser) {
    return NextResponse.json(
      { error: "Utilisateur introuvable" },
      { status: 404 },
    );
  } else {
    const isPasswordValid = password === existingUser.passwordHash;

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: "Mot de passe incorrect" },
        { status: 401 },
      );
    }
    return NextResponse.json(
      { message: "Connexion réussie", userId: existingUser.id },
      { status: 200 },
    );
  }
}
