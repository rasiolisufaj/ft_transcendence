import type { Metadata } from "next";
import { Fraunces, Public_Sans } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { RealtimeProvider } from "@/components/RealtimeProvider";
import { routing } from "@/i18n/routing";
import { getCurrentUser } from "@/lib/auth/session";
import { enableStaticRendering } from "@/i18n/static";
import "../globals.css";

const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin", "latin-ext"],
});

// The display face (nav wordmark, page headings): a serif, deliberately not
// the grotesque-everywhere look a default template reaches for.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600"],
});

export async function generateMetadata({
  params,
}: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "metadata" });
  return { title: "MesPapiers", description: t("description") };
}

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
  enableStaticRendering(locale);
  const ctx = await getCurrentUser();

  return (
    <html lang={locale} className={`${publicSans.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <NextIntlClientProvider>
          {/* Above the nav too: the bell listens to it. */}
          <RealtimeProvider signedIn={ctx !== null}>
            <Nav ctx={ctx} />
            <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
              {children}
            </main>
            <Footer />
          </RealtimeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
