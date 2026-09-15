"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { text } from "stream/consumers";
import Link from "next/link";

export default function SubscribePage() {
  const [email, setEmail] = useState("");
  const [password, setpassWord] = useState("");
  const [pseudo, setpseudo] = useState("");
  const [confirmationpassword, setconfirmationpassword] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (password != confirmationpassword) {
      setError("les mots de passe ne sont pas identique");
      return;
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
          <Link href="/login">déja un compte</Link>
        </Button>
      </form>
    </Card>
  );
}
