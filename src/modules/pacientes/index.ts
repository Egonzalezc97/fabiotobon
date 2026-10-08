import { sql } from "kysely";
import type { BaseDeDatos } from "@/lib/db";
import { normalizarCelular } from "@/lib/telefono";
import { registrar } from "@/modules/auditoria";
import { normalizarDocumento, type Documento } from "./documento";

// Ficha del paciente (fase 4): datos personales del brief §7, sin campos clínicos.
// Toda lectura de datos de pacientes desde el panel queda en auditoría; todo cambio, en el historial de la ficha.

export type ActorPanel = { userId: string };

export class DatosPacienteInvalidos extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "DatosPacienteInvalidos";
  }
}

export class DocumentoDuplicado extends Error {
  constructor() {
    super("Ya existe un paciente con ese documento.");
    this.name = "DocumentoDuplicado";
  }
}

export type DatosPaciente = {
  tipoDocumento: string;
  numeroDocumento: string;
  nombre: string;
  /** WhatsApp: el contacto que se verifica al reservar por la web. */
  celular?: string | null;
  /** Teléfono adicional, sin verificar. */
  telefono?: string | null;
  correo?: string | null;
  fechaNacimiento?: string | null;
  notas?: string;
};

/** Campos que se comparan para el historial de cambios. */
const CAMPOS_HISTORIAL = [
  "tipo_documento",
  "numero_documento",
  "nombre",
  "celular",
  "telefono",
  "correo",
  "fecha_nacimiento",
  "estado",
  "notas",
] as const;

function validar(datos: DatosPaciente) {
  const documento = normalizarDocumento(datos.tipoDocumento, datos.numeroDocumento);
  if (!documento) throw new DatosPacienteInvalidos("El documento no tiene un formato válido para su tipo.");
  const nombre = datos.nombre.trim().replace(/\s+/g, " ");
  if (nombre.length < 2 || nombre.length > 200) throw new DatosPacienteInvalidos("Escribe el nombre completo.");
  let celular: string | null = null;
  if (datos.celular?.trim()) {
    celular = normalizarCelular(datos.celular);
    if (!celular) throw new DatosPacienteInvalidos("El WhatsApp no es un celular válido.");
  }
  const telefono = datos.telefono?.trim().replace(/\s+/g, " ") || null;
  if (telefono && !/^[0-9+()\s.-]{7,40}$/.test(telefono)) throw new DatosPacienteInvalidos("El teléfono no es válido.");
  const correo = datos.correo?.trim() || null;
  if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) throw new DatosPacienteInvalidos("El correo no es válido.");
  const fechaNacimiento = datos.fechaNacimiento?.trim() || null;
  if (fechaNacimiento) {
    const hoy = new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaNacimiento) || fechaNacimiento < "1900-01-01" || fechaNacimiento > hoy) {
      throw new DatosPacienteInvalidos("La fecha de nacimiento no es válida.");
    }
  }
  return { documento, nombre, celular, telefono, correo, fechaNacimiento, notas: (datos.notas ?? "").slice(0, 2000) };
}

function esDocumentoDuplicado(error: unknown) {
  return (error as { code?: string; constraint?: string })?.constraint === "paciente_documento_unico";
}

export async function registrarEventoPaciente(
  db: BaseDeDatos,
  pacienteId: string,
  tipo: "creado" | "actualizado" | "fusion_recibida" | "fusion_absorbida",
  cambios: Record<string, unknown>,
  actor: { tipo: "usuario" | "paciente" | "sistema"; id?: string | null },
) {
  await db
    .insertInto("paciente_evento")
    .values({ paciente_id: pacienteId, tipo, cambios: JSON.stringify(cambios), actor_tipo: actor.tipo, actor_id: actor.id ?? null })
    .execute();
}

/** Crea un paciente desde el panel. El documento es obligatorio; el celular queda sin verificar. */
export async function crearPaciente(db: BaseDeDatos, datos: DatosPaciente, actor: ActorPanel): Promise<{ id: string }> {
  const v = validar(datos);
  try {
    return await db.transaction().execute(async (trx) => {
      const creado = await trx
        .insertInto("paciente")
        .values({
          tipo_documento: v.documento.tipo,
          numero_documento: v.documento.numero,
          nombre: v.nombre,
          celular: v.celular,
          telefono: v.telefono,
          correo: v.correo,
          fecha_nacimiento: v.fechaNacimiento,
          notas: v.notas,
        })
        .returning("id")
        .executeTakeFirstOrThrow();
      await registrarEventoPaciente(trx, creado.id, "creado", { origen: "panel" }, { tipo: "usuario", id: actor.userId });
      await registrar(trx, { actorId: actor.userId, actorTipo: "usuario", accion: "paciente.creado", entidad: "paciente", entidadId: creado.id });
      return creado;
    });
  } catch (error) {
    if (esDocumentoDuplicado(error)) throw new DocumentoDuplicado();
    throw error;
  }
}

/** Edita la ficha. Cambiar el celular borra su verificación. Cada campo cambiado queda en el historial. */
export async function actualizarPaciente(
  db: BaseDeDatos,
  id: string,
  datos: DatosPaciente & { estado: "activo" | "inactivo" },
  actor: ActorPanel,
): Promise<void> {
  const v = validar(datos);
  try {
    await db.transaction().execute(async (trx) => {
      const actual = await trx.selectFrom("paciente").selectAll().where("id", "=", id).forUpdate().executeTakeFirst();
      if (!actual) throw new DatosPacienteInvalidos("El paciente no existe.");
      if (actual.fusionado_con) throw new DatosPacienteInvalidos("Esta ficha se fusionó con otra y ya no se edita.");
      const nuevo = {
        tipo_documento: v.documento.tipo,
        numero_documento: v.documento.numero,
        nombre: v.nombre,
        celular: v.celular,
        telefono: v.telefono,
        correo: v.correo,
        fecha_nacimiento: v.fechaNacimiento,
        estado: datos.estado,
        notas: v.notas,
      };
      const cambios: Record<string, { antes: unknown; despues: unknown }> = {};
      for (const campo of CAMPOS_HISTORIAL) {
        if ((actual[campo] ?? null) !== (nuevo[campo] ?? null)) cambios[campo] = { antes: actual[campo] ?? null, despues: nuevo[campo] ?? null };
      }
      if (Object.keys(cambios).length === 0) return;
      await trx
        .updateTable("paciente")
        .set({ ...nuevo, ...(actual.celular !== v.celular ? { celular_verificado_en: null } : {}) })
        .where("id", "=", id)
        .execute();
      await registrarEventoPaciente(trx, id, "actualizado", cambios, { tipo: "usuario", id: actor.userId });
      await registrar(trx, {
        actorId: actor.userId,
        actorTipo: "usuario",
        accion: "paciente.actualizado",
        entidad: "paciente",
        entidadId: id,
        detalle: { campos: Object.keys(cambios).join(",") },
      });
    });
  } catch (error) {
    if (esDocumentoDuplicado(error)) throw new DocumentoDuplicado();
    throw error;
  }
}

export type ResultadoBusqueda = {
  id: string;
  nombre: string;
  tipo_documento: string | null;
  numero_documento: string | null;
  celular: string | null;
  estado: string;
};

/** Condición de búsqueda por nombre (sin tildes), número de documento o celular. */
export function condicionBusqueda(termino: string) {
  const limpio = termino.trim().slice(0, 80);
  const digitos = limpio.replace(/[\s.\-+]/g, "");
  const esNumerico = /^[0-9A-Za-z]+$/.test(digitos) && /\d/.test(digitos);
  return { limpio, digitos, esNumerico };
}

/** Busca por nombre (sin importar tildes), número de documento o celular. Queda en auditoría. */
export async function buscarPacientes(db: BaseDeDatos, termino: string, actor: ActorPanel): Promise<ResultadoBusqueda[]> {
  const { limpio, digitos, esNumerico } = condicionBusqueda(termino);
  if (limpio.length < 2) return [];
  const resultados = await db
    .selectFrom("paciente")
    .select(["id", "nombre", "tipo_documento", "numero_documento", "celular", "estado"])
    .where("fusionado_con", "is", null)
    .where((eb) =>
      esNumerico
        ? eb.or([eb("numero_documento", "like", `${digitos.toUpperCase()}%`), eb("celular", "like", `%${digitos}%`)])
        : eb(sql`unaccent(lower(nombre))`, "like", sql`'%' || unaccent(lower(${limpio})) || '%'`),
    )
    .orderBy("nombre")
    .limit(25)
    .execute();
  // Sin el término buscado: puede ser un nombre o un documento.
  await registrar(db, { actorId: actor.userId, actorTipo: "usuario", accion: "paciente.busqueda", detalle: { resultados: resultados.length } });
  return resultados;
}

/** Ficha completa: datos, citas, cartera, consentimientos e historial. Queda en auditoría. */
export async function obtenerFicha(db: BaseDeDatos, id: string, actor: ActorPanel) {
  const paciente = await db.selectFrom("paciente").selectAll().where("id", "=", id).executeTakeFirst();
  if (!paciente) return null;
  const [citas, cartera, consentimientos, eventos] = await Promise.all([
    db
      .selectFrom("cita")
      .innerJoin("servicio", "servicio.id", "cita.servicio_id")
      .select((eb) => [
        "cita.id",
        "cita.inicio",
        "cita.fin",
        "cita.estado",
        "cita.origen",
        "servicio.nombre as servicioNombre",
        eb
          .exists(eb.selectFrom("cita_evento").select("cita_evento.id").whereRef("cita_evento.cita_id", "=", "cita.id").where("cita_evento.tipo", "=", "reprogramada"))
          .as("fueReprogramada"),
      ])
      .where("cita.paciente_id", "=", id)
      .orderBy("cita.inicio", "desc")
      .execute(),
    db.selectFrom("paciente_cartera").selectAll().where("paciente_id", "=", id).executeTakeFirst(),
    db
      .selectFrom("consentimiento")
      .select(["id", "tipo", "version", "aceptado_en", "origen", "cita_id", "aceptante_nombre"])
      .where("paciente_id", "=", id)
      .orderBy("aceptado_en", "desc")
      .execute(),
    db
      .selectFrom("paciente_evento")
      .leftJoin("user", "user.id", "paciente_evento.actor_id")
      .select([
        "paciente_evento.id",
        "paciente_evento.tipo",
        "paciente_evento.cambios",
        "paciente_evento.actor_tipo",
        "paciente_evento.ocurrido_en",
        "user.name as actorNombre",
      ])
      .where("paciente_evento.paciente_id", "=", id)
      .orderBy("paciente_evento.id", "desc")
      .execute(),
  ]);
  await registrar(db, { actorId: actor.userId, actorTipo: "usuario", accion: "paciente.leido", entidad: "paciente", entidadId: id });
  return { paciente, citas, cartera, consentimientos, eventos };
}

/** Uso interno de la reserva web (no es una lectura del panel). */
export async function buscarPorDocumento(db: BaseDeDatos, documento: Documento) {
  return db
    .selectFrom("paciente")
    .select(["id", "celular", "nombre"])
    .where("tipo_documento", "=", documento.tipo)
    .where("numero_documento", "=", documento.numero)
    .forUpdate()
    .executeTakeFirst();
}

// ---------------------------------------------------------------------------
// Fusión de fichas duplicadas (solo admin).
// ---------------------------------------------------------------------------

export class FusionInvalida extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "FusionInvalida";
  }
}

/**
 * Une dos fichas de la misma persona. Queda `destinoId` con sus datos; pasan a ella las citas, los tratamientos
 * y los consentimientos de `origenId`. La ficha de origen no se borra: queda inactiva, marcada como fusionada y
 * sin documento (para que una reserva futura con ese documento no apunte a una ficha muerta). Todo queda en
 * eventos de ambas fichas, de cada cita y de cada tratamiento.
 */
export async function fusionarPacientes(
  db: BaseDeDatos,
  datos: { destinoId: string; origenId: string },
  actor: ActorPanel,
): Promise<{ citas: number; tratamientos: number; consentimientos: number }> {
  if (datos.destinoId === datos.origenId) throw new FusionInvalida("Elige dos fichas distintas.");
  return db.transaction().execute(async (trx) => {
    // Habilita mover consentimientos de ficha SOLO dentro de esta transacción (ver migración 0008).
    await sql`SELECT set_config('app.fusion_pacientes', 'on', true)`.execute(trx);
    const fichas = await trx
      .selectFrom("paciente")
      .selectAll()
      .where("id", "in", [datos.destinoId, datos.origenId])
      .orderBy("id")
      .forUpdate()
      .execute();
    const destino = fichas.find((f) => f.id === datos.destinoId);
    const origen = fichas.find((f) => f.id === datos.origenId);
    if (!destino || !origen) throw new FusionInvalida("Alguna de las fichas no existe.");
    if (destino.fusionado_con || origen.fusionado_con) throw new FusionInvalida("Alguna de las fichas ya fue fusionada.");

    const citas = await trx.updateTable("cita").set({ paciente_id: destino.id }).where("paciente_id", "=", origen.id).returning("id").execute();
    for (const c of citas) {
      await trx
        .insertInto("cita_evento")
        .values({
          cita_id: c.id,
          tipo: "paciente_cambiado",
          antes: JSON.stringify({ paciente_id: origen.id }),
          despues: JSON.stringify({ paciente_id: destino.id }),
          actor_tipo: "usuario",
          actor_id: actor.userId,
          detalle: JSON.stringify({ motivo: "fusion_de_fichas" }),
        })
        .execute();
    }
    const tratamientos = await trx
      .updateTable("tratamiento")
      .set({ paciente_id: destino.id })
      .where("paciente_id", "=", origen.id)
      .returning("id")
      .execute();
    for (const t of tratamientos) {
      await trx
        .insertInto("tratamiento_evento")
        .values({
          tratamiento_id: t.id,
          tipo: "paciente_cambiado",
          antes: JSON.stringify({ paciente_id: origen.id }),
          despues: JSON.stringify({ paciente_id: destino.id }),
          motivo: "Fusión de fichas",
          actor_id: actor.userId,
        })
        .execute();
    }
    const consentimientos = await trx
      .updateTable("consentimiento")
      .set({ paciente_id: destino.id })
      .where("paciente_id", "=", origen.id)
      .returning("id")
      .execute();

    await trx
      .updateTable("paciente")
      .set({ fusionado_con: destino.id, fusionado_en: new Date(), estado: "inactivo", tipo_documento: null, numero_documento: null })
      .where("id", "=", origen.id)
      .execute();

    const resumen = { citas: citas.length, tratamientos: tratamientos.length, consentimientos: consentimientos.length };
    const quien = { tipo: "usuario" as const, id: actor.userId };
    await registrarEventoPaciente(
      trx,
      destino.id,
      "fusion_recibida",
      {
        origen_id: origen.id,
        origen_nombre: origen.nombre,
        origen_documento: origen.tipo_documento ? `${origen.tipo_documento} ${origen.numero_documento}` : null,
        origen_celular: origen.celular,
        ...resumen,
      },
      quien,
    );
    await registrarEventoPaciente(
      trx,
      origen.id,
      "fusion_absorbida",
      { destino_id: destino.id, documento_liberado: origen.tipo_documento ? `${origen.tipo_documento} ${origen.numero_documento}` : null },
      quien,
    );
    await registrar(trx, {
      actorId: actor.userId,
      actorTipo: "usuario",
      accion: "paciente.fusionado",
      entidad: "paciente",
      entidadId: destino.id,
      detalle: { origen_id: origen.id, ...resumen },
    });
    return resumen;
  });
}
