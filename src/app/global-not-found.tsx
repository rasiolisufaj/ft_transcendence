import type { Metadata } from "next";
import Link from "next/link";

// Fires for a URL that matches no route at all (see next.config.ts:
// experimental.globalNotFound). It bypasses every layout, including
// [locale]/layout.tsx and its NextIntlClientProvider, so there is no locale
// and no messages to read: next-intl cannot be used here. Simple fix: this
// page's few words are hardcoded in all three site languages at once, so
// every visitor understands regardless of locale. For a 404 inside the app
// (an unknown category, channel, etc.), see [locale]/not-found.tsx instead,
// which is fully translated.
export const metadata: Metadata = {
  title: "404",
  description: "Page not found / Page introuvable / Página no encontrada",
};

export default function GlobalNotFound() {
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
            Page not found / Page introuvable / Página no encontrada
          </h1>
          <p style={{ color: "var(--muted)", fontSize: "0.875rem", margin: "0 0 1.5rem" }}>
            This page does not exist, or has been moved.
            <br />
            Cette page n&apos;existe pas, ou a été déplacée.
            <br />
            Esta página no existe, o ha sido movida.
          </p>
          <Link
            href="/"
            style={{
              borderRadius: "0.5rem",
              border: "1px solid var(--fg)",
              background: "var(--fg)",
              color: "var(--bg)",
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            Home / Accueil / Inicio
          </Link>
        </div>
      </body>
    </html>
  );
}
