import sharp from "sharp";
import { almacenamiento } from "@/lib/almacenamiento";
import { requerirAdmin } from "@/lib/auth/servidor";
import { db } from "@/lib/db";
import { archivoPrivado } from "@/modules/galeria";

type Contexto = { params: Promise<{ id: string }> };

const PRIVADO = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

// Original privado de una imagen de la galería (solo admin, queda en auditoría).
// ?ancho=480 devuelve una vista previa reducida generada al vuelo (no se guarda).
export async function GET(peticion: Request, contexto: Contexto) {
  const admin = await requerirAdmin();
  const { id } = await contexto.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response(null, { status: 404 });
  const archivo = await archivoPrivado(db(), almacenamiento(), "imagen", id, { userId: admin.userId });
  if (!archivo) return new Response(null, { status: 404 });
  const ancho = Number(new URL(peticion.url).searchParams.get("ancho"));
  if (ancho === 480) {
    const vista = await sharp(archivo.datos).resize({ width: 480, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
    return new Response(new Uint8Array(vista), { headers: { ...PRIVADO, "Content-Type": "image/webp" } });
  }
  return new Response(new Uint8Array(archivo.datos), { headers: { ...PRIVADO, "Content-Type": archivo.contentType } });
}
