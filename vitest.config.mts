import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    setupFiles: ["./vitest.setup.ts"],
    // DB tests share one Postgres; running files in parallel makes cleanup racy.
    fileParallelism: false,
  },
  resolve: {
    alias: { "@": path.join(root, "src") },
  },
});
