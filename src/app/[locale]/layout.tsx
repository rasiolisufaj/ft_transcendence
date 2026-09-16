import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { locales, type Locale } from "@/i18n/config";
import { Nav } from "@/components/Nav";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;

  if (!hasLocale(locales, locale)) {
    notFound();
  }

  setRequestLocale(locale as Locale);

  return (
    <NextIntlClientProvider>
      <Nav />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">{children}</main>
    </NextIntlClientProvider>
  );
}
