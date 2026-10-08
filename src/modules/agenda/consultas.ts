import type { BaseDeDatos } from "@/lib/db";
import { registrar } from "@/modules/auditoria";
import type { Intervalo } from "./disponibilidad";

// Lecturas de la agenda para el PANEL. Incluyen nombres de pacientes y motivos de bloqueo:
// nunca se usan en el sitio público.

export type CitaAgenda = {
  id: string;
  inicio: Date;
  fin: Date;
  estado: string;
  origen: string;
  revision: string | null;
  vista_en: Date | null;
  pacienteNombre: string;
  servicioNombre: string;
};

export async function listarCitasAgenda(
  db: BaseDeDatos,
  rango: Intervalo,
  opciones: { incluirCanceladas?: boolean } = {},
): Promise<CitaAgenda[]> {
  return db
    .selectFrom("cita")
    .innerJoin("paciente", "paciente.id", "cita.paciente_id")
    .innerJoin("servicio", "servicio.id", "cita.servicio_id")
    .select([
      "cita.id",
      "cita.inicio",
      "cita.fin",
      "cita.estado",
      "cita.origen",
      "cita.revision",
      "cita.vista_en",
      "paciente.nombre as pacienteNombre",
      "servicio.nombre as servicioNombre",
    ])
    .where("cita.inicio", "<", rango.fin)
    .where("cita.fin", ">", rango.inicio)
    .$if(!opciones.incluirCanceladas, (q) => q.where("cita.estado", "!=", "cancelada"))
    .orderBy("cita.inicio")
    .execute();
}

/** Indicadores del panel: citas web sin abrir y citas marcadas para revisión sin abrir. */
export async function contarPendientesDeRevisar(db: BaseDeDatos): Promise<{ webNuevas: number; enRevision: number }> {
  const fila = await db
    .selectFrom("cita")
    .select((eb) => [
      eb.fn.countAll<string>().filterWhere("revision", "is", null).filterWhere("origen", "=", "web").as("webNuevas"),
      eb.fn.countAll<string>().filterWhere("revision", "is not", null).as("enRevision"),
    ])
    .where("vista_en", "is", null)
    .executeTakeFirstOrThrow();
  return { webNuevas: Number(fila.webNuevas), enRevision: Number(fila.enRevision) };
}

export async function listarPorRevisar(db: BaseDeDatos, filtro: "nuevas" | "revision"): Promise<CitaAgenda[]> {
  return db
    .selectFrom("cita")
    .innerJoin("paciente", "paciente.id", "cita.paciente_id")
    .innerJoin("servicio", "servicio.id", "cita.servicio_id")
    .select([
      "cita.id",
      "cita.inicio",
      "cita.fin",
      "cita.estado",
      "cita.origen",
      "cita.revision",
      "cita.vista_en",
      "paciente.nombre as pacienteNombre",
      "servicio.nombre as servicioNombre",
    ])
    .where("cita.vista_en", "is", null)
    .$if(filtro === "nuevas", (q) => q.where("cita.revision", "is", null).where("cita.origen", "=", "web"))
    .$if(filtro === "revision", (q) => q.where("cita.revision", "is not", null))
    .orderBy("cita.creada_en", "desc")
    .execute();
}

/** Detalle completo de una cita con paciente e historial. Queda en auditoría. */
export async function obtenerDetalleCita(db: BaseDeDatos, id: string, actor: { userId: string }) {
  const cita = await db
    .selectFrom("cita")
    .innerJoin("paciente", "paciente.id", "cita.paciente_id")
    .innerJoin("servicio", "servicio.id", "cita.servicio_id")
    .select([
      "cita.id",
      "cita.inicio",
      "cita.fin",
      "cita.estado",
      "cita.origen",
      "cita.revision",
      "cita.vista_en",
      "cita.notas_internas",
      "cita.creada_en",
      "paciente.id as pacienteId",
      "paciente.nombre as pacienteNombre",
      "paciente.tipo_documento as pacienteTipoDocumento",
      "paciente.numero_documento as pacienteNumeroDocumento",
      "paciente.celular as pacienteCelular",
      "paciente.celular_verificado_en as pacienteCelularVerificadoEn",
      "servicio.nombre as servicioNombre",
    ])
    .where("cita.id", "=", id)
    .executeTakeFirst();
  if (!cita) return null;
  const eventos = await db
    .selectFrom("cita_evento")
    .select(["id", "tipo", "antes", "despues", "actor_tipo", "detalle", "ocurrido_en"])
    .where("cita_id", "=", id)
    .orderBy("id")
    .execute();
  await registrar(db, { actorId: actor.userId, actorTipo: "usuario", accion: "cita.leida", entidad: "cita", entidadId: id });
  return { cita, eventos };
}
