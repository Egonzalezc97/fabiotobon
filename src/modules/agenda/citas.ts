import type { BaseDeDatos } from "@/lib/db";
import { leerParametros } from "@/modules/configuracion";
import { dentroDelHorario, esCupoValido, type Intervalo } from "./disponibilidad";
import {
  ChocaConBloqueo,
  CitaNoActiva,
  CitaNoEncontrada,
  CupoNoDisponible,
  esViolacionDeExclusion,
  FueraDeHorario,
  ServicioNoDisponible,
  TransicionInvalida,
} from "./errores";
import { leerHorarioMinutos } from "./horario";
import { rangoDia, fechaLocal } from "./tiempo";
import { enTransaccion, tomarCandadoAgenda, type Actor } from "./transaccion";

// ÚNICO camino de escritura de citas (CLAUDE.md). Landing, panel y, más adelante, WhatsApp usan estas funciones.

export const ESTADOS_ACTIVOS = ["pendiente", "confirmada"] as const;
export type EstadoCita = "pendiente" | "confirmada" | "cancelada" | "cumplida" | "no_asistio";
export type OrigenCita = "web" | "panel" | "whatsapp";
export type RevisionCita = "documento_con_otro_celular" | "sin_documento";

export const NOMBRES_ESTADO: Record<EstadoCita, string> = {
  pendiente: "Pendiente",
  confirmada: "Confirmada",
  cancelada: "Cancelada",
  cumplida: "Cumplida",
  no_asistio: "No asistió",
};

/** Transiciones permitidas. Una cita cancelada no se reactiva: se crea otra. */
const TRANSICIONES: Record<EstadoCita, EstadoCita[]> = {
  pendiente: ["confirmada", "cancelada", "cumplida", "no_asistio"],
  confirmada: ["pendiente", "cancelada", "cumplida", "no_asistio"],
  cumplida: ["no_asistio"],
  no_asistio: ["cumplida"],
  cancelada: [],
};

export function transicionesPermitidas(estado: EstadoCita): EstadoCita[] {
  return TRANSICIONES[estado];
}

type Modo =
  /** Reserva pública: solo cupos ofrecidos (horario, granularidad, antelación, horizonte) y servicios públicos. */
  | { modo: "publico"; ahora?: Date }
  /** Panel: cualquier hora, pero fuera del horario exige confirmación explícita. Nunca sobre un bloqueo. */
  | { modo: "panel"; permitirFueraDeHorario?: boolean };

export type NuevaCita = {
  pacienteId: string;
  servicioId: string;
  inicio: Date;
  estado: "pendiente" | "confirmada";
  origen: OrigenCita;
  notasInternas?: string;
  revision?: RevisionCita | null;
  /** Contexto para el historial (p. ej. lo que escribió la persona en la web). */
  detalleEvento?: Record<string, unknown>;
};

type FilaCita = { id: string; inicio: Date; fin: Date; estado: string; servicio_id: string };

function serializar(c: { inicio: Date; fin: Date; estado?: string }) {
  return { inicio: c.inicio.toISOString(), fin: c.fin.toISOString(), ...(c.estado ? { estado: c.estado } : {}) };
}

async function bloqueosQueCruzan(trx: BaseDeDatos, intervalo: Intervalo) {
  return trx
    .selectFrom("bloqueo")
    .select(["id"])
    .where("inicio", "<", intervalo.fin)
    .where("fin", ">", intervalo.inicio)
    .execute();
}

/** Intervalos ocupados (bloqueos y citas activas) que tocan el rango. Solo tiempos: nada de motivos ni pacientes. */
export async function ocupadosEnRango(db: BaseDeDatos, rango: Intervalo, excluirCitaId?: string): Promise<Intervalo[]> {
  const [bloqueos, citas] = await Promise.all([
    db.selectFrom("bloqueo").select(["inicio", "fin"]).where("inicio", "<", rango.fin).where("fin", ">", rango.inicio).execute(),
    db
      .selectFrom("cita")
      .select(["inicio", "fin"])
      .where("estado", "in", ESTADOS_ACTIVOS)
      .where("inicio", "<", rango.fin)
      .where("fin", ">", rango.inicio)
      .$if(Boolean(excluirCitaId), (q) => q.where("id", "!=", excluirCitaId as string))
      .execute(),
  ]);
  return [...bloqueos, ...citas];
}

async function validarHorario(trx: BaseDeDatos, intervalo: Intervalo, modo: Modo, servicioId: string, excluirCitaId?: string) {
  if ((await bloqueosQueCruzan(trx, intervalo)).length > 0) throw new ChocaConBloqueo();

  if (modo.modo === "publico") {
    const ahora = modo.ahora ?? new Date();
    const [parametros, horario, servicio] = await Promise.all([
      leerParametros(trx),
      leerHorarioMinutos(trx),
      trx.selectFrom("servicio").select(["duracion_min"]).where("id", "=", servicioId).executeTakeFirstOrThrow(),
    ]);
    const ocupados = await ocupadosEnRango(trx, rangoDia(fechaLocal(intervalo.inicio)), excluirCitaId);
    const valido = esCupoValido(intervalo.inicio, {
      ahora,
      horario,
      ocupados,
      duracionMin: servicio.duracion_min,
      parametros,
    });
    if (!valido) throw new CupoNoDisponible();
    return;
  }

  if (!modo.permitirFueraDeHorario && !dentroDelHorario(intervalo, await leerHorarioMinutos(trx))) {
    throw new FueraDeHorario();
  }
}

/** Inserta o actualiza traduciendo la violación de la restricción de exclusión a un error de dominio. */
async function conExclusion<T>(operacion: () => Promise<T>): Promise<T> {
  try {
    return await operacion();
  } catch (error) {
    if (esViolacionDeExclusion(error)) throw new CupoNoDisponible();
    throw error;
  }
}

async function registrarEvento(
  trx: BaseDeDatos,
  citaId: string,
  tipo: "creada" | "reprogramada" | "cancelada" | "estado_cambiado" | "vista",
  actor: Actor,
  datos: { antes?: unknown; despues?: unknown; detalle?: Record<string, unknown> } = {},
) {
  await trx
    .insertInto("cita_evento")
    .values({
      cita_id: citaId,
      tipo,
      antes: datos.antes === undefined ? null : JSON.stringify(datos.antes),
      despues: datos.despues === undefined ? null : JSON.stringify(datos.despues),
      actor_tipo: actor.tipo,
      actor_id: actor.id ?? null,
      detalle: JSON.stringify(datos.detalle ?? {}),
    })
    .execute();
}

export async function crearCita(
  db: BaseDeDatos,
  datos: NuevaCita,
  opciones: Modo & { actor: Actor },
): Promise<{ id: string; inicio: Date; fin: Date }> {
  return enTransaccion(db, async (trx) => {
    await tomarCandadoAgenda(trx);
    const servicio = await trx
      .selectFrom("servicio")
      .select(["duracion_min", "activo", "politica_reserva"])
      .where("id", "=", datos.servicioId)
      .executeTakeFirst();
    if (!servicio?.activo) throw new ServicioNoDisponible();
    if (opciones.modo === "publico" && servicio.politica_reserva !== "publico") throw new ServicioNoDisponible();

    const intervalo = { inicio: datos.inicio, fin: new Date(datos.inicio.getTime() + servicio.duracion_min * 60_000) };
    await validarHorario(trx, intervalo, opciones, datos.servicioId);

    const cita = await conExclusion(() =>
      trx
        .insertInto("cita")
        .values({
          paciente_id: datos.pacienteId,
          servicio_id: datos.servicioId,
          inicio: intervalo.inicio,
          fin: intervalo.fin,
          estado: datos.estado,
          origen: datos.origen,
          notas_internas: datos.notasInternas ?? "",
          revision: datos.revision ?? null,
          // Lo que crea Fabio ya lo vio; lo que llega por la web queda "sin ver" hasta que lo abra.
          vista_en: datos.origen === "panel" ? new Date() : null,
        })
        .returning(["id", "inicio", "fin"])
        .executeTakeFirstOrThrow(),
    );
    await registrarEvento(trx, cita.id, "creada", opciones.actor, {
      despues: { ...serializar({ ...intervalo, estado: datos.estado }), servicio_id: datos.servicioId, origen: datos.origen },
      detalle: { ...(datos.detalleEvento ?? {}), ...(datos.revision ? { revision: datos.revision } : {}) },
    });
    return cita;
  });
}

async function citaParaActualizar(trx: BaseDeDatos, id: string): Promise<FilaCita> {
  const cita = await trx
    .selectFrom("cita")
    .select(["id", "inicio", "fin", "estado", "servicio_id"])
    .where("id", "=", id)
    .forUpdate()
    .executeTakeFirst();
  if (!cita) throw new CitaNoEncontrada();
  return cita;
}

function esActiva(estado: string) {
  return (ESTADOS_ACTIVOS as readonly string[]).includes(estado);
}

/**
 * Mueve la misma cita (no la duplica) conservando su duración. Si el horario nuevo no está libre,
 * la transacción se revierte y la cita conserva su horario original.
 */
export async function reprogramarCita(
  db: BaseDeDatos,
  citaId: string,
  nuevoInicio: Date,
  opciones: { actor: Actor; permitirFueraDeHorario?: boolean; detalle?: Record<string, unknown> },
): Promise<{ inicio: Date; fin: Date }> {
  return enTransaccion(db, async (trx) => {
    await tomarCandadoAgenda(trx);
    const cita = await citaParaActualizar(trx, citaId);
    if (!esActiva(cita.estado)) throw new CitaNoActiva();

    const duracion = cita.fin.getTime() - cita.inicio.getTime();
    const nuevo = { inicio: nuevoInicio, fin: new Date(nuevoInicio.getTime() + duracion) };
    await validarHorario(
      trx,
      nuevo,
      { modo: "panel", permitirFueraDeHorario: opciones.permitirFueraDeHorario },
      cita.servicio_id,
      citaId,
    );

    await conExclusion(() =>
      trx.updateTable("cita").set({ inicio: nuevo.inicio, fin: nuevo.fin }).where("id", "=", citaId).execute(),
    );
    await registrarEvento(trx, citaId, "reprogramada", opciones.actor, {
      antes: serializar({ inicio: cita.inicio, fin: cita.fin }),
      despues: serializar(nuevo),
      detalle: opciones.detalle,
    });
    return nuevo;
  });
}

export async function cancelarCita(
  db: BaseDeDatos,
  citaId: string,
  opciones: { actor: Actor; motivo?: string },
): Promise<void> {
  await enTransaccion(db, async (trx) => {
    await tomarCandadoAgenda(trx);
    const cita = await citaParaActualizar(trx, citaId);
    if (!esActiva(cita.estado)) throw new CitaNoActiva();
    await trx.updateTable("cita").set({ estado: "cancelada" }).where("id", "=", citaId).execute();
    await registrarEvento(trx, citaId, "cancelada", opciones.actor, {
      antes: { estado: cita.estado },
      despues: { estado: "cancelada" },
      detalle: opciones.motivo ? { motivo: opciones.motivo.slice(0, 300) } : {},
    });
  });
}

export async function cambiarEstadoCita(
  db: BaseDeDatos,
  citaId: string,
  nuevo: EstadoCita,
  opciones: { actor: Actor },
): Promise<void> {
  if (nuevo === "cancelada") return cancelarCita(db, citaId, opciones);
  await enTransaccion(db, async (trx) => {
    await tomarCandadoAgenda(trx);
    const cita = await citaParaActualizar(trx, citaId);
    const actual = cita.estado as EstadoCita;
    if (!TRANSICIONES[actual].includes(nuevo)) throw new TransicionInvalida(NOMBRES_ESTADO[actual], NOMBRES_ESTADO[nuevo]);
    await trx.updateTable("cita").set({ estado: nuevo }).where("id", "=", citaId).execute();
    await registrarEvento(trx, citaId, "estado_cambiado", opciones.actor, {
      antes: { estado: actual },
      despues: { estado: nuevo },
    });
  });
}

/** Marca la cita como vista por Fabio (apaga los indicadores de "nueva" y "en revisión"). Idempotente. */
export async function marcarCitaVista(db: BaseDeDatos, citaId: string, opciones: { actor: Actor }): Promise<boolean> {
  return enTransaccion(db, async (trx) => {
    const marcada = await trx
      .updateTable("cita")
      .set({ vista_en: new Date() })
      .where("id", "=", citaId)
      .where("vista_en", "is", null)
      .returning("id")
      .executeTakeFirst();
    if (marcada) await registrarEvento(trx, citaId, "vista", opciones.actor);
    return Boolean(marcada);
  });
}

