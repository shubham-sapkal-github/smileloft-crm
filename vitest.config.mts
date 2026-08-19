import { existsSync } from "node:fs";
import { defineConfig } from "vitest/config";

// Next loads .env.local automatically; Vitest does not. Load it here so tests
// talk to the same database the app does.
if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

export default defineConfig({});
