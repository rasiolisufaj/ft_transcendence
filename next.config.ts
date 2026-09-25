import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Pin the workspace root. Without it, a stray package-lock.json in any parent
// directory makes Turbopack warn on every single build — and the subject grades
// a clean output.
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: { root: projectRoot },
  // nginx serves the dev server as https://mespapiers.local; without this, Next 16
  // blocks its dev assets and HMR as cross-origin and client components stay inert.
  allowedDevOrigins: ["mespapiers.local"],
  experimental: {
    serverActions: {
      // augmente la limite par defaut de next js a 10 mo 
      bodySizeLimit: "10mb",
    },
  },
};

// Picks up src/i18n/request.ts by convention.
const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
