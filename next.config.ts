import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: { root: projectRoot },
  // Allow HMR through nginx reverse proxy (https://mespapiers.local)
  allowedDevOrigins: ["mespapiers.local"],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
    // The root layout lives at the dynamic `[locale]` segment (there is no
    // app/layout.tsx), so a URL that matches no route at all (e.g. a typo
    // with no locale prefix) never reaches [locale]/not-found.tsx — Next
    // falls back to its own hardcoded 404 instead. global-not-found.tsx is
    // Next's documented fix for exactly this layout shape.
    globalNotFound: true,
  },
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
