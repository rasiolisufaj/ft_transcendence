"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setpassWord] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email,
          password: password,
        }),
      });
      if (!response.ok) {
        throw new Error("Erreur lors de la connexion");
      }
      const data = await response.json();
      console.log("Inscription réussie :", data);
    } catch (err: any) {
      setError(err.message || " erreur inattendue.");
    }
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
