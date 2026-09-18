import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

// Pin the workspace root. Without it, a stray package-lock.json in any parent
// directory makes Turbopack warn on every single build — and the subject grades
// a clean output.
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: { root: projectRoot },
  experimental: {
    serverActions: {
      // augmente la limite par defaut de next js a 10 mo 
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
