import { sql } from "kysely";
import type { BaseDeDatos } from "@/lib/db";
import { registrar } from "@/modules/auditoria";

// Control de cuentas por paciente: tratamientos y abonos. NO es pasarela de pagos ni facturación.
// Garantías en la base (migración 0009): el tope de abonos, que los abonos no se borren ni se editen
// (solo se anulan) y que el costo inicial no cambie. Este módulo traduce esos errores y deja los eventos.

export type EstadoTratamiento = "presupuestado" | "en_curso" | "terminado" | "cancelado";
export type MedioAbono = "efectivo" | "transferencia" | "tarjeta" | "otro";
export type EstadoPago = "sin_tratamientos" | "sin_abonos" | "con_saldo" | "saldado" | "saldo_a_favor";

export const NOMBRES_ESTADO_TRATAMIENTO: Record<EstadoTratamiento, string> = {
  presupuestado: "Presupuestado",
  en_curso: "En curso",
  terminado: "Terminado",
  cancelado: "Cancelado",
};

export const NOMBRES_MEDIO: Record<MedioAbono, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
  otro: "Otro",
};

export const NOMBRES_ESTADO_PAGO: Record<EstadoPago, string> = {
  // Incluye a quien solo tiene tratamientos presupuestados: no cuentan como deuda (DPF).
  sin_tratamientos: "Sin tratamientos activos",
  sin_abonos: "Sin abonos",
  con_saldo: "Con saldo",
  saldado: "Saldado",
  saldo_a_favor: "Saldo a favor",
};

export type Actor = { userId: string };

export class ErrorTratamiento extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ErrorTratamiento";
  }
}

/** La operación deja lo abonado por encima del valor del tratamiento y no se confirmó el saldo a favor. */
export class SaldoAFavorSinConfirmar extends ErrorTratamiento {
  constructor(readonly excedente: number) {
    super(`Esto deja un saldo a favor del paciente de ${excedente.toLocaleString("es-CO")} pesos. Confírmalo para continuar.`);
  }
}

function traducirTope(error: unknown): never {
  const mensaje = (error as { message?: string })?.message ?? "";
  const m = /TOPE_ABONOS: .* en (\d+)/.exec(mensaje);
  if (m) throw new SaldoAFavorSinConfirmar(Number(m[1]));
  throw error;
}

function entero(valor: number, campo: string, minimo = 0) {
  if (!Number.isInteger(valor) || valor < minimo || valor > 1_000_000_000) {
    throw new ErrorTratamiento(`${campo}: escribe un valor entero en pesos${minimo > 0 ? " mayor que cero" : ""}.`);
  }
  return valor;
}

function motivoValido(motivo: string) {
  const limpio = motivo.trim();
  if (limpio.length < 3) throw new ErrorTratamiento("Escribe el motivo.");
  return limpio.slice(0, 300);
}

async function evento(
  db: BaseDeDatos,
  tratamientoId: string,
  tipo: string,
  actor: Actor,
  datos: { antes?: unknown; despues?: unknown; motivo?: string } = {},
) {
  await db
    .insertInto("tratamiento_evento")
    .values({
      tratamiento_id: tratamientoId,
      tipo,
      antes: datos.antes === undefined ? null : JSON.stringify(datos.antes),
      despues: datos.despues === undefined ? null : JSON.stringify(datos.despues),
      motivo: datos.motivo ?? null,
      actor_id: actor.userId,
    })
    .execute();
}

async function confirmarSaldoAFavor(trx: BaseDeDatos, confirmado: boolean) {
  if (confirmado) await sql`SELECT set_config('app.confirmar_saldo_a_favor', 'on', true)`.execute(trx);
}

export type NuevoTratamiento = {
  pacienteId: string;
  servicioId?: string | null;
  descripcion?: string;
  costoTotal: number;
  estado?: Exclude<EstadoTratamiento, "cancelado">;
  fechaInicio?: string | null;
  notas?: string;
};

export async function crearTratamiento(db: BaseDeDatos, datos: NuevoTratamiento, actor: Actor): Promise<{ id: string }> {
  const costo = entero(datos.costoTotal, "Costo total");
  const descripcion = (datos.descripcion ?? "").trim().slice(0, 500);
  if (!datos.servicioId && !descripcion) throw new ErrorTratamiento("Elige un servicio o escribe una descripción.");
  return db.transaction().execute(async (trx) => {
    const creado = await trx
      .insertInto("tratamiento")
      .values({
        paciente_id: datos.pacienteId,
        servicio_id: datos.servicioId || null,
        descripcion,
        costo_inicial: costo,
        costo_total: costo,
        estado: datos.estado ?? "presupuestado",
        fecha_inicio: datos.fechaInicio || null,
        notas: (datos.notas ?? "").slice(0, 2000),
        creado_por: actor.userId,
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    await evento(trx, creado.id, "creado", actor, { despues: { costo_total: costo, estado: datos.estado ?? "presupuestado" } });
    await registrar(trx, { actorId: actor.userId, actorTipo: "usuario", accion: "tratamiento.creado", entidad: "tratamiento", entidadId: creado.id });
    return creado;
  });
}

async function tratamientoParaActualizar(trx: BaseDeDatos, id: string) {
  const t = await trx.selectFrom("tratamiento").selectAll().where("id", "=", id).forUpdate().executeTakeFirst();
  if (!t) throw new ErrorTratamiento("El tratamiento no existe.");
  return t;
}

/** Ajuste del costo vigente (descuento o cambio del plan). El costo inicial no se toca; queda evento con motivo. */
export async function ajustarCosto(
  db: BaseDeDatos,
  id: string,
  datos: { costoTotal: number; motivo: string; confirmaSaldoAFavor?: boolean },
  actor: Actor,
) {
  const nuevo = entero(datos.costoTotal, "Costo total");
  const motivo = motivoValido(datos.motivo);
  try {
    await db.transaction().execute(async (trx) => {
      const t = await tratamientoParaActualizar(trx, id);
      if (t.estado === "cancelado") throw new ErrorTratamiento("Un tratamiento cancelado no cambia de costo.");
      if (t.costo_total === nuevo) throw new ErrorTratamiento("El costo nuevo es igual al actual.");
      await confirmarSaldoAFavor(trx, Boolean(datos.confirmaSaldoAFavor));
      await trx.updateTable("tratamiento").set({ costo_total: nuevo }).where("id", "=", id).execute();
      await evento(trx, id, "costo_ajustado", actor, { antes: { costo_total: t.costo_total }, despues: { costo_total: nuevo }, motivo });
    });
  } catch (error) {
    traducirTope(error);
  }
}

const TRANSICIONES: Record<EstadoTratamiento, EstadoTratamiento[]> = {
  presupuestado: ["en_curso", "terminado"],
  en_curso: ["terminado", "presupuestado"],
  terminado: ["en_curso"],
  cancelado: [],
};

export function transicionesTratamiento(estado: EstadoTratamiento): EstadoTratamiento[] {
  return TRANSICIONES[estado];
}

/** Cambia el estado (salvo cancelar, que tiene su propia función). */
export async function cambiarEstadoTratamiento(db: BaseDeDatos, id: string, nuevo: EstadoTratamiento, actor: Actor) {
  await db.transaction().execute(async (trx) => {
    const t = await tratamientoParaActualizar(trx, id);
    const actual = t.estado as EstadoTratamiento;
    if (!TRANSICIONES[actual].includes(nuevo)) throw new ErrorTratamiento("Ese cambio de estado no está permitido.");
    const hoy = new Date().toISOString().slice(0, 10);
    await trx
      .updateTable("tratamiento")
      .set({
        estado: nuevo,
        ...(nuevo === "en_curso" && !t.fecha_inicio ? { fecha_inicio: hoy } : {}),
        ...(nuevo === "terminado" ? { fecha_fin: t.fecha_fin ?? hoy } : {}),
      })
      .where("id", "=", id)
      .execute();
    await evento(trx, id, "estado_cambiado", actor, { antes: { estado: actual }, despues: { estado: nuevo } });
  });
}

/**
 * Cancelar: se indica el valor de lo realizado (por defecto, lo abonado) con motivo obligatorio.
 * El saldo se calcula contra ese valor: deuda si lo abonado es menor, saldo a favor si es mayor
 * (en ese caso exige confirmación explícita).
 */
export async function cancelarTratamiento(
  db: BaseDeDatos,
  id: string,
  datos: { valorRealizado?: number | null; motivo: string; confirmaSaldoAFavor?: boolean },
  actor: Actor,
) {
  const motivo = motivoValido(datos.motivo);
  try {
    await db.transaction().execute(async (trx) => {
      const t = await tratamientoParaActualizar(trx, id);
      if (t.estado === "cancelado") throw new ErrorTratamiento("El tratamiento ya está cancelado.");
      const abonado = await totalAbonado(trx, id);
      const valor = datos.valorRealizado == null ? abonado : entero(datos.valorRealizado, "Valor de lo realizado");
      await confirmarSaldoAFavor(trx, Boolean(datos.confirmaSaldoAFavor));
      await trx
        .updateTable("tratamiento")
        .set({ estado: "cancelado", valor_realizado: valor, fecha_fin: t.fecha_fin ?? new Date().toISOString().slice(0, 10) })
        .where("id", "=", id)
        .execute();
      await evento(trx, id, "cancelado", actor, {
        antes: { estado: t.estado, costo_total: t.costo_total },
        despues: { estado: "cancelado", valor_realizado: valor, abonado },
        motivo,
      });
    });
  } catch (error) {
    traducirTope(error);
  }
}

async function totalAbonado(db: BaseDeDatos, tratamientoId: string): Promise<number> {
  const fila = await db
    .selectFrom("abono")
    .select((eb) => eb.fn.coalesce(eb.fn.sum<string>("valor"), eb.lit(0)).as("total"))
    .where("tratamiento_id", "=", tratamientoId)
    .where("anulado_en", "is", null)
    .executeTakeFirstOrThrow();
  return Number(fila.total);
}

export async function registrarAbono(
  db: BaseDeDatos,
  datos: {
    tratamientoId: string;
    valor: number;
    fecha: string;
    medio: MedioAbono;
    referencia?: string;
    confirmaSaldoAFavor?: boolean;
  },
  actor: Actor,
): Promise<{ id: string }> {
  const valor = entero(datos.valor, "Valor del abono", 1);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datos.fecha)) throw new ErrorTratamiento("Elige la fecha del abono.");
  if (!Object.hasOwn(NOMBRES_MEDIO, datos.medio)) throw new ErrorTratamiento("Elige el medio de pago.");
  try {
    return await db.transaction().execute(async (trx) => {
      const abono = await trx
        .insertInto("abono")
        .values({
          tratamiento_id: datos.tratamientoId,
          valor,
          fecha: datos.fecha,
          medio: datos.medio,
          referencia: (datos.referencia ?? "").trim().slice(0, 120),
          registrado_por: actor.userId,
          confirma_saldo_a_favor: Boolean(datos.confirmaSaldoAFavor),
        })
        .returning("id")
        .executeTakeFirstOrThrow();
      await evento(trx, datos.tratamientoId, "abono_registrado", actor, {
        despues: { abono_id: abono.id, valor, medio: datos.medio, fecha: datos.fecha },
      });
      return abono;
    });
  } catch (error) {
    traducirTope(error);
  }
}

export async function anularAbono(db: BaseDeDatos, abonoId: string, motivo: string, actor: Actor) {
  const limpio = motivoValido(motivo);
  await db.transaction().execute(async (trx) => {
    const a = await trx.selectFrom("abono").selectAll().where("id", "=", abonoId).forUpdate().executeTakeFirst();
    if (!a) throw new ErrorTratamiento("El abono no existe.");
    if (a.anulado_en) throw new ErrorTratamiento("El abono ya está anulado.");
    await trx
      .updateTable("abono")
      .set({ anulado_en: new Date(), anulado_por: actor.userId, motivo_anulacion: limpio })
      .where("id", "=", abonoId)
      .execute();
    await evento(trx, a.tratamiento_id, "abono_anulado", actor, { antes: { abono_id: abonoId, valor: a.valor }, motivo: limpio });
  });
}

// ---------------------------------------------------------------------------
// Lecturas (panel). Montos y estado de pago salen de las vistas: se calculan, no se guardan.
// ---------------------------------------------------------------------------

export async function listarTratamientosPaciente(db: BaseDeDatos, pacienteId: string) {
  return db
    .selectFrom("tratamiento")
    .innerJoin("tratamiento_saldo", "tratamiento_saldo.tratamiento_id", "tratamiento.id")
    .leftJoin("servicio", "servicio.id", "tratamiento.servicio_id")
    .select([
      "tratamiento.id",
      "tratamiento.descripcion",
      "tratamiento.estado",
      "tratamiento.costo_inicial",
      "tratamiento.costo_total",
      "tratamiento.valor_realizado",
      "tratamiento.fecha_inicio",
      "tratamiento.fecha_fin",
      "tratamiento.creado_en",
      "servicio.nombre as servicioNombre",
      "tratamiento_saldo.base",
      "tratamiento_saldo.abonado",
      "tratamiento_saldo.saldo",
      "tratamiento_saldo.estado_pago",
    ])
    .where("tratamiento.paciente_id", "=", pacienteId)
    .orderBy("tratamiento.creado_en", "desc")
    .execute();
}

/** Detalle con abonos e historial. Queda en auditoría (datos de cuentas del paciente). */
export async function obtenerTratamiento(db: BaseDeDatos, id: string, actor: Actor) {
  const t = await db
    .selectFrom("tratamiento")
    .innerJoin("tratamiento_saldo", "tratamiento_saldo.tratamiento_id", "tratamiento.id")
    .innerJoin("paciente", "paciente.id", "tratamiento.paciente_id")
    .leftJoin("servicio", "servicio.id", "tratamiento.servicio_id")
    .select([
      "tratamiento.id",
      "tratamiento.paciente_id",
      "tratamiento.descripcion",
      "tratamiento.estado",
      "tratamiento.costo_inicial",
      "tratamiento.costo_total",
      "tratamiento.valor_realizado",
      "tratamiento.fecha_inicio",
      "tratamiento.fecha_fin",
      "tratamiento.notas",
      "paciente.nombre as pacienteNombre",
      "servicio.nombre as servicioNombre",
      "tratamiento_saldo.base",
      "tratamiento_saldo.abonado",
      "tratamiento_saldo.saldo",
      "tratamiento_saldo.estado_pago",
    ])
    .where("tratamiento.id", "=", id)
    .executeTakeFirst();
  if (!t) return null;
  const [abonos, eventos] = await Promise.all([
    db.selectFrom("abono").selectAll().where("tratamiento_id", "=", id).orderBy("fecha", "desc").orderBy("creado_en", "desc").execute(),
    db
      .selectFrom("tratamiento_evento")
      .leftJoin("user", "user.id", "tratamiento_evento.actor_id")
      .select([
        "tratamiento_evento.id",
        "tratamiento_evento.tipo",
        "tratamiento_evento.antes",
        "tratamiento_evento.despues",
        "tratamiento_evento.motivo",
        "tratamiento_evento.ocurrido_en",
        "user.name as actorNombre",
      ])
      .where("tratamiento_evento.tratamiento_id", "=", id)
      .orderBy("tratamiento_evento.id", "desc")
      .execute(),
  ]);
  await registrar(db, { actorId: actor.userId, actorTipo: "usuario", accion: "tratamiento.leido", entidad: "tratamiento", entidadId: id });
  return { tratamiento: t, abonos, eventos };
}

/** Panel → Inicio. Fechas del mes en hora de Bogotá. */
export async function resumenCartera(db: BaseDeDatos, mes: string): Promise<{ porCobrar: number; pacientesConSaldo: number; abonosDelMes: number; presupuestado: number }> {
  const [cartera, abonos, presupuestos] = await Promise.all([
    db
      .selectFrom("paciente_cartera")
      .innerJoin("paciente", "paciente.id", "paciente_cartera.paciente_id")
      .select((eb) => [
        eb.fn.coalesce(eb.fn.sum<string>("paciente_cartera.saldo"), eb.lit(0)).as("total"),
        eb.fn.countAll<string>().as("pacientes"),
      ])
      .where("paciente_cartera.saldo", ">", 0)
      .where("paciente.fusionado_con", "is", null)
      .executeTakeFirstOrThrow(),
    db
      .selectFrom("abono")
      .select((eb) => eb.fn.coalesce(eb.fn.sum<string>("valor"), eb.lit(0)).as("total"))
      .where("anulado_en", "is", null)
      .where("fecha", ">=", `${mes}-01`)
      .where(sql<boolean>`fecha < (${`${mes}-01`}::date + interval '1 month')`)
      .executeTakeFirstOrThrow(),
    db
      .selectFrom("tratamiento_saldo")
      .select((eb) => eb.fn.coalesce(eb.fn.sum<string>("saldo"), eb.lit(0)).as("total"))
      .where("estado", "=", "presupuestado")
      .where("saldo", ">", 0)
      .executeTakeFirstOrThrow(),
  ]);
  return {
    porCobrar: Number(cartera.total),
    pacientesConSaldo: Number(cartera.pacientes),
    abonosDelMes: Number(abonos.total),
    presupuestado: Number(presupuestos.total),
  };
}
