import { almacenamiento } from "@/lib/almacenamiento";
import { requerirAdmin } from "@/lib/auth/servidor";
import { db } from "@/lib/db";
import { archivoPrivado } from "@/modules/galeria";

type Contexto = { params: Promise<{ id: string }> };

// Documento firmado de un consentimiento de uso de imagen (solo admin, queda en auditoría).
export async function GET(_peticion: Request, contexto: Contexto) {
  const admin = await requerirAdmin();
  const { id } = await contexto.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response(null, { status: 404 });
  const archivo = await archivoPrivado(db(), almacenamiento(), "consentimiento", id, { userId: admin.userId });
  if (!archivo) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(archivo.datos), {
    headers: {
      "Content-Type": archivo.contentType,
      "Content-Disposition": `inline; filename="consentimiento-${id.slice(0, 8)}.${archivo.contentType === "application/pdf" ? "pdf" : archivo.contentType === "image/png" ? "png" : "jpg"}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      // Un PDF abierto en el navegador no ejecuta nada de este sitio.
      "Content-Security-Policy": "sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
    },
  });
}
