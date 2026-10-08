import { NextResponse } from "next/server";
import { almacenamiento } from "@/lib/almacenamiento";
import { requerirAdmin } from "@/lib/auth/servidor";
import { db } from "@/lib/db";
import { ImagenInvalida, TAMANO_MAXIMO } from "@/lib/imagenes";
import { CuerpoDemasiadoGrande, leerFormularioLimitado, mismoOrigen } from "@/lib/peticion";
import { subirImagen } from "@/modules/galeria";

// Subida de una imagen de la galería (solo admin). Devuelve el id para vincularla a un caso.
// Ruta de API y no acción de servidor: las acciones limitan el cuerpo a 1 MB y una foto pesa más.
export async function POST(peticion: Request) {
  const admin = await requerirAdmin();
  if (!mismoOrigen(peticion)) return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
  let formulario: FormData;
  try {
    formulario = await leerFormularioLimitado(peticion, TAMANO_MAXIMO + 64 * 1024);
  } catch (error) {
    if (error instanceof CuerpoDemasiadoGrande) return NextResponse.json({ error: "La imagen supera 15 MB." }, { status: 413 });
    return NextResponse.json({ error: "No se pudo leer el archivo." }, { status: 400 });
  }
  const archivo = formulario.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) return NextResponse.json({ error: "Elige una imagen." }, { status: 400 });
  try {
    const imagen = await subirImagen(db(), almacenamiento(), Buffer.from(await archivo.arrayBuffer()), { userId: admin.userId });
    return NextResponse.json(imagen);
  } catch (error) {
    if (error instanceof ImagenInvalida) return NextResponse.json({ error: error.message }, { status: 422 });
    throw error;
  }
}
