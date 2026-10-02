type Messages = Record<string, unknown>;

export function keysOf(messages: Messages, prefix = ""): string[] {
  const keys: string[] = [];

  for (const name in messages) {
    const value = messages[name];
    const fullName = prefix + name;

    if (typeof value === "object" && value !== null) {
      const childKeys = keysOf(value as Messages, fullName + ".");
      for (const childKey of childKeys) {
        keys.push(childKey);
      }
    } else {
      keys.push(fullName);
    }
  }
  return keys;
}

//reference -> (fr) | keys -> en/es
export function findMissing(reference: string[], keys: string[]): string[] {
  const missing: string[] = [];
  for (const key of reference) {
    if (!keys.includes(key)) {
      missing.push(key);
    }
  }
  return missing;
}

export function findUsedKeys(source: string): { keys: string[]; prefixes: string[] } {
  const keys: string[] = [];
  const prefixes: string[] = [];

  const lines = source.split("\n");

  for (const line of lines) {
    const isBinding = line.includes("useTranslations(") || line.includes("getTranslations(");
    if (!line.includes("const ") || !isBinding) {
      continue;
    }

    const name = line.split("const ")[1]?.split(" =")[0] ?? "";
    if (name === "") {
      continue;
    }

    const namespace = line.split('"')[1] ?? "";

    // "nav" + "dashboard" → "nav.dashboard"
    function withNamespace(key: string): string {
      if (namespace === "") {
        return key;
      }
      return namespace + "." + key;
    }

    for (const key of callsOf(source, name, '"')) {
      keys.push(withNamespace(key));
    }

    for (const template of callsOf(source, name, "`")) {
      const fixedPart = template.split("${")[0] ?? "";
      prefixes.push(withNamespace(fixedPart));
    }
  }

  return { keys, prefixes };
}

const WORD_CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_$";

function callsOf(source: string, name: string, quote: string): string[] {
  const found: string[] = [];
  const pieces = source.split(name + "(" + quote);

  for (let i = 1; i < pieces.length; i++) {
    const before = pieces[i - 1] ?? "";
    const lastChar = before[before.length - 1] ?? "";

    if (WORD_CHARS.includes(lastChar)) {
      continue;
    }
    const key = (pieces[i] ?? "").split(quote)[0] ?? "";
    found.push(key);
  }

  return found;
}

export function findUnused(reference: string[], usedKeys: string[], usedPrefixes: string[]): string[] {
  const unused: string[] = [];

  for (const key of reference) {
    if (usedKeys.includes(key)) {
      continue;
    }
    let coveredByPrefix = false;
    for (const prefix of usedPrefixes) {
      if (key.startsWith(prefix)) {
        coveredByPrefix = true;
      }
    }
    if (coveredByPrefix) {
      continue;
    }
    unused.push(key);
  }
  return unused;
}
