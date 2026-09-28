import type { routing } from "./routing";
import type messages from "../../messages/fr.json";

// fr.json is the reference catalogue: t("unknown.key") fails the typecheck.
declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages;
  }
}
