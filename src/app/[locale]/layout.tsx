import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MesPapiers",
  description:
    "A personal French paperwork assistant — track your documents, deadlines and renewals.",
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        <NextIntlClientProvider>
          <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
              <Link href="/" className="text-xl font-semibold tracking-tight">
                MesPapiers
              </Link>
              <div className="flex items-center gap-6 text-sm">
                <Link
                  href="/"
                  className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  Dashboard
                </Link>
                <Link
                  href="/documents/new"
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                >
                  Add Document
                </Link>
              </div>
            </nav>
          </header>
          <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
            {children}
          </main>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
