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
  allowedDevOrigins: ['mespapiers.local'],
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
