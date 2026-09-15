"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import Link from "next/link";

export default function LoginPage() {
  //  cree une boite qui garde en memoire ce que la personne ecrit dans le champ email
  const [email, setEmail] = useState("");
  const [password, setpassWord] = useState("");
  // se declenche quand on clique sur le bouton pour envoyer le formulaire
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
  }
  return (
    <Card>
      <h1 className="text-3xl font-semibold mb-6">Connexion</h1>
      <form onSubmit={handleSubmit}>
        <label htmlFor="email">Email</label>
        <Input
          type="email"
          name="email"
          id="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <label htmlFor="password">mot de passe</label>
        <Input
          type="password"
          name="password"
          id="password"
          value={password}
          onChange={(e) => setpassWord(e.target.value)}
        />
        <Button>Se connecter</Button>
        <Button>
          <Link href="/subscribe">Pas encore de compte ?</Link>
        </Button>
      </form>
    </Card>
  );
}
