import { NextResponse } from "next/server";
import { almacenamiento } from "@/lib/almacenamiento";
import { requerirAdmin } from "@/lib/auth/servidor";
import { db } from "@/lib/db";
import { TAMANO_MAXIMO } from "@/lib/imagenes";
import { CuerpoDemasiadoGrande, leerFormularioLimitado, mismoOrigen } from "@/lib/peticion";
import { ErrorGaleria, registrarConsentimientoImagen } from "@/modules/galeria";

const texto = (f: FormData, clave: string) => String(f.get(clave) ?? "").trim();

// Registro de un consentimiento de uso de imagen (solo admin), con el documento firmado o la marca "en físico".
export async function POST(peticion: Request) {
  const admin = await requerirAdmin();
  if (!mismoOrigen(peticion)) return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
  let f: FormData;
  try {
    f = await leerFormularioLimitado(peticion, TAMANO_MAXIMO + 64 * 1024);
  } catch (error) {
    if (error instanceof CuerpoDemasiadoGrande) return NextResponse.json({ error: "El documento supera 15 MB." }, { status: 413 });
    return NextResponse.json({ error: "No se pudo leer el formulario." }, { status: 400 });
  }
  const archivo = f.get("archivo");
  try {
    const { id } = await registrarConsentimientoImagen(
      db(),
      almacenamiento(),
      {
        pacienteId: texto(f, "pacienteId"),
        fechaFirma: texto(f, "fechaFirma"),
        archivo: archivo instanceof File && archivo.size > 0 ? Buffer.from(await archivo.arrayBuffer()) : null,
        enFisico: f.get("enFisico") === "si",
        verificadoPor: texto(f, "verificadoPor"),
        notas: texto(f, "notas"),
      },
      { userId: admin.userId },
    );
    return NextResponse.json({ id });
  } catch (error) {
    if (error instanceof ErrorGaleria) return NextResponse.json({ error: error.message }, { status: 422 });
    throw error;
  }
}
