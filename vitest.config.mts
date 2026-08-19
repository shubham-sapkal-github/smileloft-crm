import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Next loads .env.local automatically; Vitest does not. Load it here so tests
// talk to the same database the app does.
if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

export default defineConfig({
  // `server-only` throws unless resolved under the react-server condition,
  // which Vitest does not set — and setting the condition alone does not help,
  // because the package is externalised and resolved by Node, not Vite. Point
  // it at the same empty module the react-server condition would have given.
  resolve: {
    alias: {
      "server-only": fileURLToPath(
        new URL("node_modules/server-only/empty.js", import.meta.url),
      ),
    },
  },
});
