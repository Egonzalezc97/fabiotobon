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

/**
 * Rutas de API que reciben formularios (subidas del panel): exige que la petición venga del mismo sitio.
 * Las acciones de servidor de Next ya lo verifican; las rutas de API no.
 */
export function mismoOrigen(peticion: Request): boolean {
  const origen = peticion.headers.get("origin");
  const host = peticion.headers.get("x-forwarded-host") ?? peticion.headers.get("host");
  if (!origen || !host) return false;
  try {
    return new URL(origen).host === host;
  } catch {
    return false;
  }
}

export class CuerpoDemasiadoGrande extends Error {}

/** Lee un formulario multipart con un tope de bytes, sin confiar en Content-Length. */
export async function leerFormularioLimitado(peticion: Request, maximo: number): Promise<FormData> {
  const declarado = Number(peticion.headers.get("content-length") ?? "0");
  if (declarado > maximo) throw new CuerpoDemasiadoGrande();
  if (!peticion.body) return new FormData();
  const lector = peticion.body.getReader();
  const partes: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    total += value.byteLength;
    if (total > maximo) {
      await lector.cancel();
      throw new CuerpoDemasiadoGrande();
    }
    partes.push(value);
  }
  const tipo = peticion.headers.get("content-type") ?? "";
  return new Response(Buffer.concat(partes), { headers: { "content-type": tipo } }).formData();
}
