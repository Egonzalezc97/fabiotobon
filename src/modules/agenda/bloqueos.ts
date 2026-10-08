import type { BaseDeDatos } from "@/lib/db";
import { registrar } from "@/modules/auditoria";
import { cancelarCita, ESTADOS_ACTIVOS, reprogramarCita } from "./citas";
import type { Intervalo } from "./disponibilidad";
import { BloqueoConConflictos, ErrorAgenda, type CitaAfectada } from "./errores";
import { instante, sumarDias, type FechaLocal } from "./tiempo";
import { enTransaccion, tomarCandadoAgenda, type Actor } from "./transaccion";

// Bloqueos de agenda. Un bloqueo que choca con citas activas NUNCA se guarda en silencio:
// cada cita afectada necesita una decisión (reprogramar o cancelar), y todo se aplica en una sola transacción.

export type ResolucionCita =
  | { citaId: string; accion: "cancelar" }
  | { citaId: string; accion: "reprogramar"; nuevoInicio: Date; permitirFueraDeHorario?: boolean };

export type NuevoBloqueo = Intervalo & { diaCompleto: boolean; motivo: string };

/** Días completos en Bogotá: de la medianoche de `desde` a la medianoche siguiente a `hasta`. */
export function intervaloDeDias(desde: FechaLocal, hasta: FechaLocal): Intervalo {
  return { inicio: instante(desde), fin: instante(sumarDias(hasta, 1)) };
}

export class ResolucionesInvalidas extends ErrorAgenda {
  constructor(mensaje: string) {
    super(mensaje);
  }
}

/** Citas activas que se cruzan con el intervalo (para mostrarle a Fabio antes de confirmar). */
export async function citasAfectadas(db: BaseDeDatos, intervalo: Intervalo): Promise<CitaAfectada[]> {
  return db
    .selectFrom("cita")
    .innerJoin("paciente", "paciente.id", "cita.paciente_id")
    .innerJoin("servicio", "servicio.id", "cita.servicio_id")
    .select([
      "cita.id",
      "cita.inicio",
      "cita.fin",
      "paciente.nombre as pacienteNombre",
      "paciente.celular as pacienteCelular",
      "servicio.nombre as servicioNombre",
    ])
    .where("cita.estado", "in", ESTADOS_ACTIVOS)
    .where("cita.inicio", "<", intervalo.fin)
    .where("cita.fin", ">", intervalo.inicio)
    .orderBy("cita.inicio")
    .execute();
}

export async function crearBloqueo(
  db: BaseDeDatos,
  bloqueo: NuevoBloqueo,
  resoluciones: ResolucionCita[],
  opciones: { actor: Actor },
): Promise<{ id: string }> {
  if (!(bloqueo.fin > bloqueo.inicio)) throw new ResolucionesInvalidas("El bloqueo debe terminar después de empezar.");

  return enTransaccion(db, async (trx) => {
    await tomarCandadoAgenda(trx);

    const afectadas = await citasAfectadas(trx, bloqueo);
    const idsAfectadas = new Set(afectadas.map((c) => c.id));
    const idsResueltas = new Set(resoluciones.map((r) => r.citaId));
    if (idsResueltas.size !== resoluciones.length) throw new ResolucionesInvalidas("Hay decisiones repetidas para una misma cita.");
    if ([...idsResueltas].some((id) => !idsAfectadas.has(id))) {
      throw new ResolucionesInvalidas("Hay decisiones para citas que no se cruzan con el bloqueo.");
    }
    // Falta decidir sobre alguna cita: no se guarda nada y se devuelven todas las afectadas.
    if (afectadas.some((c) => !idsResueltas.has(c.id))) throw new BloqueoConConflictos(afectadas);

    const creado = await trx
      .insertInto("bloqueo")
      .values({
        inicio: bloqueo.inicio,
        fin: bloqueo.fin,
        dia_completo: bloqueo.diaCompleto,
        motivo: bloqueo.motivo.trim().slice(0, 300),
        creado_por: opciones.actor.id ?? null,
      })
      .returning("id")
      .executeTakeFirstOrThrow();

    // Primero las cancelaciones (liberan espacio), luego las reprogramaciones. Las reprogramaciones
    // se validan contra todos los bloqueos, incluido el recién insertado.
    const detalle = { bloqueo_id: creado.id };
    for (const r of resoluciones) {
      if (r.accion === "cancelar") {
        await cancelarCita(trx, r.citaId, { actor: opciones.actor, motivo: "Bloqueo de agenda" });
      }
    }
    for (const r of resoluciones) {
      if (r.accion === "reprogramar") {
        await reprogramarCita(trx, r.citaId, r.nuevoInicio, {
          actor: opciones.actor,
          permitirFueraDeHorario: r.permitirFueraDeHorario,
          detalle,
        });
      }
    }

    // Comprobación final: ninguna cita activa queda dentro del bloqueo.
    if ((await citasAfectadas(trx, bloqueo)).length > 0) {
      throw new ResolucionesInvalidas("Después de aplicar las decisiones aún hay citas dentro del bloqueo.");
    }

    await registrar(trx, {
      actorId: opciones.actor.id ?? null,
      actorTipo: "usuario",
      accion: "bloqueo.creado",
      entidad: "bloqueo",
      entidadId: creado.id,
      detalle: { citas_resueltas: resoluciones.length },
    });
    return creado;
  });
}

export async function eliminarBloqueo(db: BaseDeDatos, id: string, opciones: { actor: Actor }): Promise<void> {
  await enTransaccion(db, async (trx) => {
    const borrado = await trx.deleteFrom("bloqueo").where("id", "=", id).returning("id").executeTakeFirst();
    if (!borrado) return;
    await registrar(trx, {
      actorId: opciones.actor.id ?? null,
      actorTipo: "usuario",
      accion: "bloqueo.eliminado",
      entidad: "bloqueo",
      entidadId: id,
    });
  });
}

/** Bloqueos que tocan el rango, con motivo. SOLO para el panel. */
export async function listarBloqueos(db: BaseDeDatos, rango: Intervalo) {
  return db
    .selectFrom("bloqueo")
    .select(["id", "inicio", "fin", "dia_completo", "motivo"])
    .where("inicio", "<", rango.fin)
    .where("fin", ">", rango.inicio)
    .orderBy("inicio")
    .execute();
}
