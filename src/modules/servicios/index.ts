import type { BaseDeDatos } from "@/lib/db";

export type ServicioPublico = {
  slug: string;
  nombre: string;
  descripcion: string;
  duracionMin: number;
  /** Solo viene si el servicio tiene `mostrar_precio`; si no, el precio nunca sale del servidor. */
  precioCop: number | null;
};

/** Servicios activos y marcados como visibles en la landing, en el orden definido por Fabio. */
export async function listarServiciosLanding(db: BaseDeDatos): Promise<ServicioPublico[]> {
  const filas = await db
    .selectFrom("servicio")
    .select(["slug", "nombre", "descripcion", "duracion_min", "precio_cop", "mostrar_precio"])
    .where("activo", "=", true)
    .where("visible_en_landing", "=", true)
    .orderBy("orden")
    .orderBy("nombre")
    .execute();

  return filas.map((f) => ({
    slug: f.slug,
    nombre: f.nombre,
    descripcion: f.descripcion,
    duracionMin: f.duracion_min,
    precioCop: f.mostrar_precio ? f.precio_cop : null,
  }));
}

export function formatearDuracion(minutos: number): string {
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  if (horas === 0) return `${resto} min`;
  return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`;
}

const pesos = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

export function formatearPrecio(cop: number): string {
  return pesos.format(cop);
}
