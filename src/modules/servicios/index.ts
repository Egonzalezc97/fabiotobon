import type { BaseDeDatos } from "@/lib/db";
import { registrar } from "@/modules/auditoria";

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

// ---------------------------------------------------------------------------
// Panel: administración de servicios. Se desactivan, nunca se borran.
// ---------------------------------------------------------------------------

export const POLITICAS_RESERVA = {
  publico: "Cualquier persona desde la web (pacientes nuevos)",
  pacientes: "Solo pacientes habilitados (fase 4)",
  solo_admin: "Solo desde el panel",
} as const;

export type PoliticaReserva = keyof typeof POLITICAS_RESERVA;

export type ServicioPanel = {
  id: string;
  slug: string;
  nombre: string;
  descripcion: string;
  duracion_min: number;
  precio_cop: number | null;
  mostrar_precio: boolean;
  visible_en_landing: boolean;
  politica_reserva: string;
  orden: number;
  activo: boolean;
};

export async function listarServiciosPanel(db: BaseDeDatos, opciones: { soloActivos?: boolean } = {}): Promise<ServicioPanel[]> {
  return db
    .selectFrom("servicio")
    .select(["id", "slug", "nombre", "descripcion", "duracion_min", "precio_cop", "mostrar_precio", "visible_en_landing", "politica_reserva", "orden", "activo"])
    .$if(Boolean(opciones.soloActivos), (q) => q.where("activo", "=", true))
    .orderBy("activo", "desc")
    .orderBy("orden")
    .orderBy("nombre")
    .execute();
}

export async function obtenerServicio(db: BaseDeDatos, id: string): Promise<ServicioPanel | undefined> {
  return (await listarServiciosPanel(db)).find((s) => s.id === id);
}

export class ServicioInvalido extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ServicioInvalido";
  }
}

export type DatosServicio = {
  nombre: string;
  descripcion: string;
  duracionMin: number;
  precioCop: number | null;
  mostrarPrecio: boolean;
  visibleEnLanding: boolean;
  politicaReserva: string;
  orden: number;
  activo: boolean;
};

function aSlug(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function validarServicio(d: DatosServicio) {
  const nombre = d.nombre.trim().replace(/\s+/g, " ");
  if (nombre.length < 2 || nombre.length > 120) throw new ServicioInvalido("Escribe un nombre de entre 2 y 120 caracteres.");
  if (d.descripcion.length > 1000) throw new ServicioInvalido("La descripción admite hasta 1.000 caracteres.");
  if (!Number.isInteger(d.duracionMin) || d.duracionMin < 5 || d.duracionMin > 600 || d.duracionMin % 5 !== 0) {
    throw new ServicioInvalido("La duración debe ser de 5 a 600 minutos, en múltiplos de 5.");
  }
  if (d.precioCop !== null && (!Number.isInteger(d.precioCop) || d.precioCop < 0 || d.precioCop > 1_000_000_000)) {
    throw new ServicioInvalido("El precio debe ser un número entero de pesos.");
  }
  if (d.mostrarPrecio && d.precioCop === null) throw new ServicioInvalido("Para mostrar el precio, escríbelo.");
  if (!Object.hasOwn(POLITICAS_RESERVA, d.politicaReserva)) throw new ServicioInvalido("Elige quién puede reservarlo.");
  if (!Number.isInteger(d.orden) || d.orden < 0 || d.orden > 999) throw new ServicioInvalido("El orden debe estar entre 0 y 999.");
  return { ...d, nombre, descripcion: d.descripcion.trim() };
}

/** Crea (sin `id`) o actualiza un servicio. Queda en auditoría. */
export async function guardarServicio(
  db: BaseDeDatos,
  datos: DatosServicio,
  opciones: { id?: string; actorId: string },
): Promise<{ id: string }> {
  const v = validarServicio(datos);
  const valores = {
    nombre: v.nombre,
    descripcion: v.descripcion,
    duracion_min: v.duracionMin,
    precio_cop: v.precioCop,
    mostrar_precio: v.mostrarPrecio,
    visible_en_landing: v.visibleEnLanding,
    politica_reserva: v.politicaReserva,
    orden: v.orden,
    activo: v.activo,
  };
  const resultado = await db.transaction().execute(async (trx) => {
    if (opciones.id) {
      const fila = await trx.updateTable("servicio").set(valores).where("id", "=", opciones.id).returning("id").executeTakeFirst();
      if (!fila) throw new ServicioInvalido("El servicio no existe.");
      return fila;
    }
    const base = aSlug(v.nombre) || "servicio";
    let slug = base;
    for (let i = 2; await trx.selectFrom("servicio").select("id").where("slug", "=", slug).executeTakeFirst(); i++) slug = `${base}-${i}`;
    return trx.insertInto("servicio").values({ ...valores, slug }).returning("id").executeTakeFirstOrThrow();
  });
  await registrar(db, {
    actorId: opciones.actorId,
    actorTipo: "usuario",
    accion: opciones.id ? "servicio.actualizado" : "servicio.creado",
    entidad: "servicio",
    entidadId: resultado.id,
  });
  return resultado;
}
