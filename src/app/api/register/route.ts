import { NextResponse } from "next/server"; // fabrique la reponse que on envoie au navigateur
import bcrypt from "bcrypt";
import { prisma } from "@/lib/db";

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
  // verife le password
  if (password.length < 8) {
    return NextResponse.json({ error: "mots de passe invalide" },{status: 400});
  }
  // verifie si le user existe deja
  const existingUser = await prisma.user.findUnique({
    where: { email: email },
  });
  if (existingUser) {
    return NextResponse.json(
      { error: "cet email est deja utilisé" },
      { status: 409 },
    );
  }

  // verifie si le pseudo existe deje
  const existingPseudo = await prisma.user.findFirst({
    where: { displayName: pseudo },
  });

  if (existingPseudo) {
    return NextResponse.json({ error: "pseudo deja existant" },{status: 409});
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email: email,
      displayName: pseudo,
      passwordHash: passwordHash,
    },
  });
  return NextResponse.json({ message: "utilisateur cree" }, { status: 201 });
}
