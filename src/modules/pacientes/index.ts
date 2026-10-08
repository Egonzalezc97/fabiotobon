import { sql } from "kysely";
import type { BaseDeDatos } from "@/lib/db";
import { normalizarCelular } from "@/lib/telefono";
import { registrar } from "@/modules/auditoria";
import { normalizarDocumento, type Documento } from "./documento";

// Ficha mínima del paciente (fase 2): solo lo necesario para agendar. El CRM completo es la fase 4.
// Toda lectura de datos de pacientes desde el panel queda en auditoría.

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
  celular?: string | null;
  correo?: string | null;
  notas?: string;
};

function validar(datos: DatosPaciente) {
  const documento = normalizarDocumento(datos.tipoDocumento, datos.numeroDocumento);
  if (!documento) throw new DatosPacienteInvalidos("El documento no tiene un formato válido para su tipo.");
  const nombre = datos.nombre.trim().replace(/\s+/g, " ");
  if (nombre.length < 2 || nombre.length > 200) throw new DatosPacienteInvalidos("Escribe el nombre completo.");
  let celular: string | null = null;
  if (datos.celular?.trim()) {
    celular = normalizarCelular(datos.celular);
    if (!celular) throw new DatosPacienteInvalidos("El celular no es válido.");
  }
  const correo = datos.correo?.trim() || null;
  if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) throw new DatosPacienteInvalidos("El correo no es válido.");
  return { documento, nombre, celular, correo, notas: (datos.notas ?? "").slice(0, 2000) };
}

function esDocumentoDuplicado(error: unknown) {
  return (error as { code?: string; constraint?: string })?.constraint === "paciente_documento_unico";
}

/** Crea un paciente desde el panel. El documento es obligatorio; el celular queda sin verificar. */
export async function crearPaciente(db: BaseDeDatos, datos: DatosPaciente, actor: ActorPanel): Promise<{ id: string }> {
  const v = validar(datos);
  try {
    const creado = await db
      .insertInto("paciente")
      .values({
        tipo_documento: v.documento.tipo,
        numero_documento: v.documento.numero,
        nombre: v.nombre,
        celular: v.celular,
        correo: v.correo,
        notas: v.notas,
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    await registrar(db, { actorId: actor.userId, actorTipo: "usuario", accion: "paciente.creado", entidad: "paciente", entidadId: creado.id });
    return creado;
  } catch (error) {
    if (esDocumentoDuplicado(error)) throw new DocumentoDuplicado();
    throw error;
  }
}

/** Edita la ficha mínima. Cambiar el celular borra su verificación. */
export async function actualizarPaciente(
  db: BaseDeDatos,
  id: string,
  datos: DatosPaciente & { estado: "activo" | "inactivo" },
  actor: ActorPanel,
): Promise<void> {
  const v = validar(datos);
  try {
    await db.transaction().execute(async (trx) => {
      const actual = await trx.selectFrom("paciente").select(["celular"]).where("id", "=", id).forUpdate().executeTakeFirst();
      if (!actual) throw new DatosPacienteInvalidos("El paciente no existe.");
      await trx
        .updateTable("paciente")
        .set({
          tipo_documento: v.documento.tipo,
          numero_documento: v.documento.numero,
          nombre: v.nombre,
          celular: v.celular,
          correo: v.correo,
          notas: v.notas,
          estado: datos.estado,
          ...(actual.celular !== v.celular ? { celular_verificado_en: null } : {}),
        })
        .where("id", "=", id)
        .execute();
      await registrar(trx, { actorId: actor.userId, actorTipo: "usuario", accion: "paciente.actualizado", entidad: "paciente", entidadId: id });
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

/** Busca por nombre (sin importar tildes), número de documento o celular. Queda en auditoría. */
export async function buscarPacientes(db: BaseDeDatos, termino: string, actor: ActorPanel): Promise<ResultadoBusqueda[]> {
  const limpio = termino.trim().slice(0, 80);
  if (limpio.length < 2) return [];
  const digitos = limpio.replace(/[\s.\-+]/g, "");
  const esNumerico = /^[0-9A-Za-z]+$/.test(digitos) && /\d/.test(digitos);

  const resultados = await db
    .selectFrom("paciente")
    .select(["id", "nombre", "tipo_documento", "numero_documento", "celular", "estado"])
    .where((eb) =>
      esNumerico
        ? eb.or([
            eb("numero_documento", "like", `${digitos.toUpperCase()}%`),
            eb("celular", "like", `%${digitos}%`),
          ])
        : eb(sql`unaccent(lower(nombre))`, "like", sql`'%' || unaccent(lower(${limpio})) || '%'`),
    )
    .orderBy("nombre")
    .limit(25)
    .execute();

  // Sin el término buscado: puede ser un nombre o un documento.
  await registrar(db, {
    actorId: actor.userId,
    actorTipo: "usuario",
    accion: "paciente.busqueda",
    detalle: { resultados: resultados.length },
  });
  return resultados;
}

/** Ficha mínima con sus citas. Queda en auditoría. */
export async function obtenerFicha(db: BaseDeDatos, id: string, actor: ActorPanel) {
  const paciente = await db.selectFrom("paciente").selectAll().where("id", "=", id).executeTakeFirst();
  if (!paciente) return null;
  const citas = await db
    .selectFrom("cita")
    .innerJoin("servicio", "servicio.id", "cita.servicio_id")
    .select(["cita.id", "cita.inicio", "cita.fin", "cita.estado", "cita.origen", "servicio.nombre as servicioNombre"])
    .where("cita.paciente_id", "=", id)
    .orderBy("cita.inicio", "desc")
    .execute();
  await registrar(db, { actorId: actor.userId, actorTipo: "usuario", accion: "paciente.leido", entidad: "paciente", entidadId: id });
  return { paciente, citas };
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
