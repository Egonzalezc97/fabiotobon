import { almacenamiento } from "@/lib/almacenamiento";
import { db } from "@/lib/db";
import { varianteParaServir } from "@/modules/galeria";

type Contexto = { params: Promise<{ archivo: string }> };

// Versiones públicas de la galería. Solo se sirven si la imagen pertenece a un caso publicado:
// al despublicar dejan de responder aunque alguien guarde la URL.
export async function GET(_peticion: Request, contexto: Contexto) {
  const { archivo } = await contexto.params;
  const variante = await varianteParaServir(db(), archivo);
  const datos = variante ? await almacenamiento().leer(variante.clave) : null;
  if (!variante || !datos) return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  return new Response(new Uint8Array(datos), {
    headers: {
      "Content-Type": `image/${variante.formato}`,
      // Caché corta: un caso despublicado deja de verse en minutos también en cachés intermedias.
      "Cache-Control": "public, max-age=600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
