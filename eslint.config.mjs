import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // CLAUDE.md: `modules/` no importa nada de `app/`.
    files: ["src/modules/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [{ group: ["@/app/*", "**/app/*"], message: "modules/ no puede importar de app/." }] },
      ],
    },
  },
  globalIgnores([".next/**", "node_modules/**", "next-env.d.ts", "src/lib/db/tipos.ts"]),
]);
