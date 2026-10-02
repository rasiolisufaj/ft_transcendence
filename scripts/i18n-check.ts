import { readdirSync, readFileSync } from "node:fs";
import { findMissing, findOrphans, findUnused, findUsedKeys, keysOf } from "../src/i18n/check";
import { defaultLocale, locales } from "../src/i18n/config";

// read & parse all language file in list of key
function loadKeys(locale: string): string[] {
  const text = readFileSync(`messages/${locale}.json`, "utf8");
  const messages = JSON.parse(text);
  return keysOf(messages);
}

// fr is reference so don't forget add first in fr after in es/en
const referenceKeys = loadKeys(defaultLocale);
let problems = 0;

for (const locale of locales) {
  if (locale === defaultLocale) {
    continue; // if fr continue
  }

  const localeKeys = loadKeys(locale);
  const missing = findMissing(referenceKeys, localeKeys);

  for (const key of missing) {
    console.error(`✗ ${locale}.json — missing: ${key}`);
    problems++;
  }

  const orphans = findOrphans(referenceKeys, localeKeys);

  for (const key of orphans) {
    console.error(`✗ ${locale}.json — orphan: ${key}`);
    problems++;
  }
}

const usedKeys: string[] = [];
const usedPrefixes: string[] = [];

// all file in src/
const files = readdirSync("src", { recursive: true, encoding: "utf8" });

for (const file of files) {
  const isCode = file.endsWith(".ts") || file.endsWith(".tsx");
  const isTest = file.endsWith(".test.ts") || file.endsWith(".test.tsx");
  const isGenerated = file.startsWith("generated");
  if (!isCode || isTest || isGenerated) {
    continue;
  }

  const source = readFileSync(`src/${file}`, "utf8");
  const used = findUsedKeys(source);
  usedKeys.push(...used.keys);
  usedPrefixes.push(...used.prefixes);
}

for (const key of findUnused(referenceKeys, usedKeys, usedPrefixes)) {
  console.warn(`⚠ ${defaultLocale}.json — unused: ${key}`);
}

if (problems > 0) {
  process.exit(1);
}
console.log(`✓ i18n: ${referenceKeys.length} keys, ${locales.join(" / ")} in sync`);
