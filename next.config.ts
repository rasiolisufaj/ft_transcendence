import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

// Pin the workspace root. Without it, a stray package-lock.json in any parent
// directory makes Turbopack warn on every single build — and the subject grades
// a clean output.
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: { root: projectRoot },
  // Le navigateur atteint l'app via https://mespapiers.local (nginx), pas via
  // localhost:3000. Sans cette liste, `next dev` repond 403 au handshake
  // WebSocket de /_next/hmr — requete cross-origin a ses yeux — et le client
  // dev, dont le HMR fait partie du bootstrap, n'hydrate jamais la page :
  // les composants client restent inertes. Voir PROJECT_PLAN A3.
  allowedDevOrigins: ["mespapiers.local"],
  experimental: {
    serverActions: {
      // augmente la limite par defaut de next js a 10 mo 
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
