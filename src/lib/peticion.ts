import { headers } from "next/headers";

/**
 * IP y navegador de la petición actual. En Railway la IP real llega en x-forwarded-for (primer valor),
 * agregada por su proxy. Sin proxy confiable ese encabezado se puede falsificar: ver riesgos de la fase 2.
 */
export async function datosPeticion(): Promise<{ ip: string | null; userAgent: string | null }> {
  const h = await headers();
  const reenviada = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return {
    ip: reenviada || h.get("x-real-ip") || null,
    userAgent: h.get("user-agent")?.slice(0, 500) ?? null,
  };
}
