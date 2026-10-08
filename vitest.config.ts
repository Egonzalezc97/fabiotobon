import { existsSync } from "node:fs";
import path from "node:path";
import { defineConfig } from "vitest/config";

if (existsSync(".env")) process.loadEnvFile(".env");

const urlPruebas = process.env.DATABASE_URL_TEST;

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/preparar-base.ts"],
    // Todas las pruebas comparten la base de pruebas: se ejecutan en serie.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 60_000,
    env: {
      NODE_ENV: "test",
      APP_ENV: "development",
      DATABASE_URL: urlPruebas ?? "",
      BETTER_AUTH_SECRET: "secreto-solo-para-pruebas-automatizadas-0123456789",
      BETTER_AUTH_URL: "http://localhost:3000",
    },
  },
});
