import { NextResponse } from "next/server"; // fabrique la reponse que on envoie au navigateur
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

// request : request les donne que le navigateur envoie mdp pseudo ..
export async function POST(request: Request) {
  const body = await request.json();
  const email = body.email;
  const pseudo = body.pseudo;
  const password = body.password;
  // verifie si les variable sont vide
  if (!email || !pseudo || !password) {
    return NextResponse.json({ error: "Champs manquants" }, { status: 400 });
  }
  // verifie si la variable mail a bien @
  if (!email.includes("@")) {
    return NextResponse.json({ error: "Email invalide" }, { status: 400 });
  }
  const existingUser = await prisma.user.findUnique({
    where: { email: email },
  });
  if (existingUser) {
    return NextResponse.json(
      { error: "cet email est deja utilisé" },
      { status: 409 },
    );
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email: email,
      displayname: pseudo,
      passwordHash: passwordHash,
    },
  });
  return NextResponse.json({ message: "ok" });
}
