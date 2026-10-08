import { db } from "@/lib/db";
import { listarConsentimientosImagen } from "@/modules/galeria";
import { listarServiciosPanel } from "@/modules/servicios";

/** Opciones de los selectores del formulario de caso. Lo llaman páginas que ya exigieron rol admin. */
export async function opcionesCaso() {
  const [servicios, consentimientos] = await Promise.all([listarServiciosPanel(db(), { soloActivos: true }), listarConsentimientosImagen(db())]);
  return {
    servicios: servicios.map((s) => ({ id: s.id, nombre: s.nombre })),
    consentimientos: consentimientos.map((c) => ({
      id: c.id,
      texto: `${c.pacienteNombre} · firmado ${c.fecha_firma} · ${c.en_fisico ? `en físico, verificó ${c.verificado_por}` : "documento adjunto"}`,
    })),
  };
}
