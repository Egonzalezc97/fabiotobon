import sharp from "sharp";
import type { Almacenamiento } from "@/lib/almacenamiento";
import type { BaseDeDatos } from "@/lib/db";
import { crearCaso, publicarCaso, subirImagen } from "@/modules/galeria";

// Caso de galería de DEMOSTRACIÓN. Las imágenes son bloques grises generados aquí, rotulados como
// relleno: nunca fotos de pacientes ni de bancos de imágenes. Usa el mismo camino que una subida real
// (limpieza, caso, consentimiento y publicación) para poder revisar el flujo completo en local.

const ACTOR = { userId: "semilla-demo" };

function relleno(fondo: string, tinta: string, rotulo: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="960">
    <rect width="1440" height="960" fill="${fondo}"/>
    <text x="64" y="896" font-family="Arial, Helvetica, sans-serif" font-size="28" letter-spacing="6" fill="${tinta}">${rotulo}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toBuffer();
}

/** Crea y publica el caso de demostración si aún no existe. Devuelve true si lo creó. */
export async function sembrarGaleriaDemo(db: BaseDeDatos, alm: Almacenamiento): Promise<boolean> {
  const existente = await db
    .selectFrom("caso_galeria")
    .innerJoin("consentimiento_imagen", "consentimiento_imagen.id", "caso_galeria.consentimiento_imagen_id")
    .innerJoin("paciente", "paciente.id", "consentimiento_imagen.paciente_id")
    .select("caso_galeria.id")
    .where("paciente.numero_documento", "like", "DEMO%")
    .executeTakeFirst();
  if (existente) return false;

  const consentimiento = await db
    .selectFrom("consentimiento_imagen")
    .innerJoin("paciente", "paciente.id", "consentimiento_imagen.paciente_id")
    .select("consentimiento_imagen.id")
    .where("paciente.numero_documento", "=", "DEMO0003")
    .executeTakeFirst();
  if (!consentimiento) throw new Error("Falta el consentimiento de demostración: carga primero db/seed/demo.sql.");

  const servicio = await db.selectFrom("servicio").select("id").where("slug", "=", "blanqueamiento-dental").executeTakeFirst();
  const antes = await subirImagen(db, alm, await relleno("#8a8f96", "#e8eaec", "ANTES · IMAGEN DE DEMOSTRACIÓN"), ACTOR);
  const despues = await subirImagen(db, alm, await relleno("#d9dcdf", "#5b6067", "DESPUÉS · IMAGEN DE DEMOSTRACIÓN"), ACTOR);
  const { id } = await crearCaso(
    db,
    {
      procedimiento: "Blanqueamiento",
      servicioId: servicio?.id ?? null,
      descripcion: "Caso de demostración con imágenes de relleno.",
      imagenAntesId: antes.id,
      imagenDespuesId: despues.id,
      consentimientoImagenId: consentimiento.id,
    },
    ACTOR,
  );
  await publicarCaso(db, alm, id, ACTOR);
  return true;
}
