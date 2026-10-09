import { createHash } from "node:crypto";
import { sql } from "kysely";
import type { BaseDeDatos } from "@/lib/db";
import { registrar } from "@/modules/auditoria";

const sha256 = (texto: string) => createHash("sha256").update(texto).digest("hex");

// ---------------------------------------------------------------------------
// Autorización de tratamiento de datos (casilla de la reserva). La redacta Fabio con su abogado.
// Versionada y de solo inserción: cada consentimiento referencia la versión que aceptó el paciente.
// La vigente es la última. Una de demostración o una "borrador-…" no habilita la reserva en producción.
// ---------------------------------------------------------------------------

export type TextoAutorizacion = {
  version: string;
  texto: string;
  demostracion: boolean;
  /** Versión "borrador-…": texto real pero sin aprobar. */
  borrador: boolean;
};

export type VersionAutorizacion = TextoAutorizacion & { creadoEn: Date; creadoPor: string | null };

export const LIMITES_AUTORIZACION = { minimo: 20, maximo: 20_000 } as const;

function aTexto(f: { version: string; texto: string; demostracion: boolean }): TextoAutorizacion {
  return { version: f.version, texto: f.texto, demostracion: f.demostracion, borrador: f.version.startsWith("borrador") };
}

export async function leerTextoAutorizacion(db: BaseDeDatos): Promise<TextoAutorizacion | null> {
  const fila = await db
    .selectFrom("texto_autorizacion")
    .select(["version", "texto", "demostracion"])
    .orderBy("orden", "desc")
    .limit(1)
    .executeTakeFirst();
  return fila ? aTexto(fila) : null;
}

/** Todas las versiones, de la más reciente a la más antigua, con el nombre de quien la guardó. */
export async function listarVersionesAutorizacion(db: BaseDeDatos): Promise<VersionAutorizacion[]> {
  const filas = await db
    .selectFrom("texto_autorizacion")
    .leftJoin("user", "user.id", "texto_autorizacion.creado_por")
    .select(["version", "texto", "demostracion", "creado_en", "user.name as autor"])
    .orderBy("orden", "desc")
    .execute();
  return filas.map((f) => ({ ...aTexto(f), creadoEn: f.creado_en, creadoPor: f.autor }));
}

export class AutorizacionInvalida extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "AutorizacionInvalida";
  }
}

/** "2026-10-08" o "borrador-2026-10-08"; si ya existe, "-2", "-3"… */
async function siguienteVersion(db: BaseDeDatos, borrador: boolean, ahora: Date): Promise<string> {
  const fecha = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(ahora);
  const base = borrador ? `borrador-${fecha}` : fecha;
  const existentes = new Set(
    (await db.selectFrom("texto_autorizacion").select("version").where("version", "like", `${base}%`).execute()).map((f) => f.version),
  );
  if (!existentes.has(base)) return base;
  let n = 2;
  while (existentes.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/**
 * Crea una versión nueva (nunca sobrescribe). Si el texto y el estado de borrador son los de la vigente, no hace nada.
 * Queda en auditoría con el hash del texto.
 */
export async function guardarAutorizacion(
  db: BaseDeDatos,
  entrada: { texto: string; borrador: boolean },
  actor: { id: string | null; tipo: "usuario" | "sistema" },
  ahora = new Date(),
): Promise<{ version: string; creada: boolean }> {
  const texto = entrada.texto.replace(/\r\n/g, "\n").trim();
  if (texto.length < LIMITES_AUTORIZACION.minimo) throw new AutorizacionInvalida("El texto de la autorización está vacío o es muy corto.");
  if (texto.length > LIMITES_AUTORIZACION.maximo) {
    throw new AutorizacionInvalida(`La autorización admite hasta ${LIMITES_AUTORIZACION.maximo.toLocaleString("es-CO")} caracteres.`);
  }
  return db.transaction().execute(async (trx) => {
    // Serializa versiones simultáneas (dos admins guardando a la vez): la segunda ve la versión de la primera.
    await sql`LOCK TABLE texto_autorizacion IN SHARE ROW EXCLUSIVE MODE`.execute(trx);
    const vigente = await leerTextoAutorizacion(trx);
    if (vigente && vigente.texto === texto && vigente.borrador === entrada.borrador && !vigente.demostracion) {
      return { version: vigente.version, creada: false };
    }
    const version = await siguienteVersion(trx, entrada.borrador, ahora);
    await trx.insertInto("texto_autorizacion").values({ version, texto, creado_por: actor.id }).execute();
    await registrar(trx, {
      actorId: actor.id,
      actorTipo: actor.tipo,
      accion: "autorizacion.version_creada",
      detalle: { version, sha256: sha256(texto), caracteres: texto.length, borrador: entrada.borrador },
    });
    return { version, creada: true };
  });
}

/** Texto de la casilla a partir del borrador en markdown: sin títulos ni notas (citas). */
export function textoAutorizacionDesdeMarkdown(markdown: string): string {
  return markdown
    .split(/\r?\n/)
    .filter((l) => !/^\s*(#|>)/.test(l))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ---------------------------------------------------------------------------
// Política de tratamiento de datos (Ley 1581 de 2012). Markdown en la configuración: se actualiza sin desplegar.
// Solo se publica completa y aprobada: mientras tenga un marcador, en producción la página no existe.
// ---------------------------------------------------------------------------

export const CLAVE_POLITICA = "politica_datos_markdown";
export const MAXIMO_POLITICA = 50_000;

/** Marcadores que impiden publicar, con lo que falta en palabras. */
export const MARCADORES_POLITICA = [
  { marcador: "[CORREO PARA SOLICITUDES]", falta: "correo para solicitudes" },
  { marcador: "[FECHA", falta: "fecha de publicación" },
  { marcador: "BORRADOR", falta: "aprobación de Fabio (el texto aún dice BORRADOR)" },
] as const;

export type EstadoPolitica = { texto: string | null; publicable: boolean; faltantes: string[] };

export function evaluarPolitica(texto: string | null): EstadoPolitica {
  const limpio = texto?.trim() ? texto.trim() : null;
  if (!limpio) return { texto: null, publicable: false, faltantes: ["texto de la política"] };
  const faltantes = MARCADORES_POLITICA.filter((m) => limpio.includes(m.marcador)).map((m) => m.falta);
  return { texto: limpio, publicable: faltantes.length === 0, faltantes };
}

export async function leerPolitica(db: BaseDeDatos): Promise<EstadoPolitica> {
  const fila = await db.selectFrom("configuracion").select("valor").where("clave", "=", CLAVE_POLITICA).executeTakeFirst();
  return evaluarPolitica(typeof fila?.valor === "string" ? fila.valor : null);
}

export class PoliticaInvalida extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "PoliticaInvalida";
  }
}

/** Guarda la política (solo admin; lo verifica la acción). Vacía, se borra. Queda en auditoría con el hash. */
export async function guardarPolitica(
  db: BaseDeDatos,
  texto: string,
  actor: { id: string | null; tipo: "usuario" | "sistema" },
): Promise<EstadoPolitica> {
  const limpio = texto.replace(/\r\n/g, "\n").trim();
  if (limpio.length > MAXIMO_POLITICA) {
    throw new PoliticaInvalida(`La política admite hasta ${MAXIMO_POLITICA.toLocaleString("es-CO")} caracteres.`);
  }
  const estado = evaluarPolitica(limpio);
  await db.transaction().execute(async (trx) => {
    if (!limpio) {
      await trx.deleteFrom("configuracion").where("clave", "=", CLAVE_POLITICA).execute();
    } else {
      const valor = JSON.stringify(limpio);
      await trx
        .insertInto("configuracion")
        .values({ clave: CLAVE_POLITICA, valor })
        .onConflict((oc) => oc.column("clave").doUpdateSet({ valor }))
        .execute();
    }
    await registrar(trx, {
      actorId: actor.id,
      actorTipo: actor.tipo,
      accion: "politica.actualizada",
      detalle: { sha256: sha256(limpio), caracteres: limpio.length, publicable: estado.publicable },
    });
  });
  return estado;
}

// ---------------------------------------------------------------------------
// Carga de borradores en desarrollo (`npm run politica:cargar-borrador`). Nunca en producción.
// No pisa lo que ya exista salvo con `forzar` (la autorización, además, nunca se sobrescribe: crea versión).
// ---------------------------------------------------------------------------

export class BorradorEnProduccion extends Error {
  constructor() {
    super("Los borradores legales no se cargan en producción.");
  }
}

export async function cargarBorradoresLegales(
  db: BaseDeDatos,
  textos: { politica: string; autorizacionMarkdown: string },
  opciones: { forzar: boolean; produccion: boolean },
): Promise<{ politica: "cargada" | "existente"; autorizacion: string | "existente" }> {
  if (opciones.produccion) throw new BorradorEnProduccion();
  const sistema = { id: null, tipo: "sistema" } as const;

  const politicaActual = await leerPolitica(db);
  let politica: "cargada" | "existente" = "existente";
  if (!politicaActual.texto || opciones.forzar) {
    await guardarPolitica(db, textos.politica, sistema);
    politica = "cargada";
  }

  const vigente = await leerTextoAutorizacion(db);
  let autorizacion: string | "existente" = "existente";
  // Una versión de demostración no cuenta como texto existente: el borrador real la reemplaza.
  if (!vigente || vigente.demostracion || opciones.forzar) {
    const r = await guardarAutorizacion(db, { texto: textoAutorizacionDesdeMarkdown(textos.autorizacionMarkdown), borrador: true }, sistema);
    autorizacion = r.version;
  }
  return { politica, autorizacion };
}
