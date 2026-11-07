import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Mirrors the "@/*" -> "./src/*" path mapping in tsconfig.json.
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
    // src/generated is the Prisma client, created at install time. Tests must
    // never import it (mock "@/lib/db" instead).
    exclude: ["**/node_modules/**", ".next/**", "src/generated/**"],
    setupFiles: ["./vitest.setup.ts"],
  },
});
