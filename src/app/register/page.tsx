"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import Link from "next/link";

export default function SubscribePage() {
  const [email, setEmail] = useState("");
  const [password, setpassWord] = useState("");
  const [pseudo, setpseudo] = useState("");
  const [confirmationpassword, setconfirmationpassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (password != confirmationpassword) {
      setError("les mots de passe ne sont pas identique");
      return;
    }
    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email,
          pseudo: pseudo,
          password: password,
        }),
      });

      if (!response.ok) {
        throw new Error("Erreur lors de l'inscription");
      }
      const data = await response.json();
      console.log("Inscription réussie :", data);
    } catch (err: any) {
      setError(err.message || " erreur inattendue.");
    }
  }
  return (
    <Card>
      <h1 className="text-3xl font-semibold mb-6">inscription</h1>
      <form onSubmit={handleSubmit}>
        <label htmlFor="email">Email</label>
        <Input
          type="email"
          name="email"
          id="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <label htmlFor="pseudo">Pseudo</label>
        <Input
          type="text"
          name="pseudo"
          id="pseudo"
          value={pseudo}
          onChange={(e) => setpseudo(e.target.value)}
        />
        <label htmlFor="password">mot de passe</label>
        <Input
          type="password"
          name="password"
          id="password"
          value={password}
          onChange={(e) => setpassWord(e.target.value)}
        />
        <label htmlFor="confirmepassword">confirmer votre mot de passe</label>
        <Input
          type="password"
          name="confirmepassword"
          id="confirmepassword"
          value={confirmationpassword}
          onChange={(e) => setconfirmationpassword(e.target.value)}
        />
        {error && <p>{error}</p>}
        <Button>Sinscrire</Button>
        <Button>
          <Link href="/subscribe">déja un compte</Link>
        </Button>
      </form>
    </Card>
  );
}
