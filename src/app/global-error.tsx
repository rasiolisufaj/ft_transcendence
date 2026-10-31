"use client";

import { useEffect } from "react";
import Link from "next/link";

// This boundary only fires when the root layout itself throws (e.g. Nav),
// since error.js never wraps the layout in its own segment. It replaces the
// whole <html> document, so it renders outside the [locale] segment and the
// NextIntlClientProvider: next-intl has no locale and no messages to read
// here, and metadata/generateMetadata are unsupported in error boundaries.
// Simple fix: this page's few words are hardcoded in all three site
// languages at once, so every visitor understands regardless of locale.
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="fr">
      <head>
        <style>{`
          :root { --bg: #fafafa; --fg: #18181b; --muted: #71717a; --border: #e4e4e7; }
          @media (prefers-color-scheme: dark) {
            :root { --bg: #09090b; --fg: #f4f4f5; --muted: #a1a1aa; --border: #3f3f46; }
          }
          body { margin: 0; background: var(--bg); color: var(--fg); font-family: Arial, Helvetica, sans-serif; }
        `}</style>
      </head>
      <body>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: "2rem",
          }}
        >
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600, margin: "0 0 0.75rem" }}>
            Something went wrong / Une erreur est survenue / Ha ocurrido un error
          </h1>
          <p style={{ color: "var(--muted)", fontSize: "0.875rem", margin: "0 0 1.5rem" }}>
            Please try again, or go back to the home page.
            <br />
            Veuillez réessayer, ou revenir à la page d&apos;accueil.
            <br />
            Vuelva a intentarlo, o regrese a la página de inicio.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", justifyContent: "center" }}>
            <button
              onClick={() => retry()}
              style={{
                borderRadius: "0.5rem",
                border: "1px solid var(--fg)",
                background: "var(--fg)",
                color: "var(--bg)",
                padding: "0.5rem 1rem",
                fontSize: "0.875rem",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Try again / Réessayer / Reintentar
            </button>
            <Link
              href="/"
              style={{
                borderRadius: "0.5rem",
                border: "1px solid var(--border)",
                color: "var(--fg)",
                padding: "0.5rem 1rem",
                fontSize: "0.875rem",
                fontWeight: 500,
                textDecoration: "none",
              }}
            >
              Home / Accueil / Inicio
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
