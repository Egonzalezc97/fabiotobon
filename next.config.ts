import type { NextConfig } from "next";
import { verificarDespliegue } from "./src/lib/despliegue";

// Falla `next build` y `next start` si se intenta publicar contenido de demostración en producción.
verificarDespliegue(process.env);

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Evita que `next dev` agregue su propio bloque de reglas a CLAUDE.md.
  agentRules: false,
  // `pg` usa módulos nativos de Node; no se empaqueta.
  serverExternalPackages: ["pg"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        source: "/admin/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
