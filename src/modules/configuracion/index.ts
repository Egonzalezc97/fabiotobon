import type { BaseDeDatos } from "@/lib/db";
import { registrar } from "@/modules/auditoria";

/**
 * Datos de contacto y del profesional. Viven en `configuracion` para que Fabio los edite sin desplegar.
 * Un valor ausente o inválido se devuelve como null y la interfaz muestra "[PENDIENTE: …]".
 */
export type DatosContacto = {
  direccion: string | null;
  ciudad: string | null;
  telefono: string | null;
  /** Solo dígitos, con indicativo de país (p. ej. 57…), listo para wa.me. */
  whatsapp: string | null;
  /** Mensaje inicial que se escribe solo al abrir WhatsApp. */
  mensajeWhatsapp: string | null;
  correo: string | null;
  registroProfesional: string | null;
};

const CLAVES = {
  direccion: "contacto_direccion",
  ciudad: "contacto_ciudad",
  telefono: "contacto_telefono",
  whatsapp: "contacto_whatsapp",
  mensajeWhatsapp: "contacto_whatsapp_mensaje",
  correo: "contacto_correo",
  registroProfesional: "registro_profesional",
} as const satisfies Record<keyof DatosContacto, string>;

/** Enlace wa.me con el mensaje inicial (si hay). */
export function enlaceWhatsapp(numero: string, mensaje?: string | null): string {
  return mensaje ? `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}` : `https://wa.me/${numero}`;
}

export const CLAVE_CONTENIDO_DEMO = "contenido_demo";

function texto(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const limpio = valor.trim();
  return limpio.length > 0 && limpio.length <= 300 ? limpio : null;
}

export function normalizarWhatsapp(valor: unknown): string | null {
  const t = texto(valor);
  if (!t) return null;
  const digitos = t.replace(/[\s+()-]/g, "");
  return /^\d{10,15}$/.test(digitos) ? digitos : null;
}

function correo(valor: unknown): string | null {
  const t = texto(valor);
  return t && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t) ? t : null;
}

export type ContactoPublico = DatosContacto & { enlaceWhatsapp: string | null };

export async function leerContacto(db: BaseDeDatos): Promise<ContactoPublico> {
  const filas = await db
    .selectFrom("configuracion")
    .select(["clave", "valor"])
    .where("clave", "in", Object.values(CLAVES))
    .execute();
  const valor = (clave: string) => filas.find((f) => f.clave === clave)?.valor;

  const whatsapp = normalizarWhatsapp(valor(CLAVES.whatsapp));
  const mensajeWhatsapp = texto(valor(CLAVES.mensajeWhatsapp));
  return {
    direccion: texto(valor(CLAVES.direccion)),
    ciudad: texto(valor(CLAVES.ciudad)),
    telefono: texto(valor(CLAVES.telefono)),
    whatsapp,
    mensajeWhatsapp,
    correo: correo(valor(CLAVES.correo)),
    registroProfesional: texto(valor(CLAVES.registroProfesional)),
    enlaceWhatsapp: whatsapp ? enlaceWhatsapp(whatsapp, mensajeWhatsapp) : null,
  };
}

export class ContactoInvalido extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ContactoInvalido";
  }
}

/**
 * Guarda los datos de contacto desde el panel. Un campo vacío se borra (la web muestra "[PENDIENTE: …]").
 * Queda en auditoría.
 */
export async function guardarContacto(
  db: BaseDeDatos,
  datos: Record<keyof DatosContacto, string>,
  actorId: string,
): Promise<void> {
  const limpio = Object.fromEntries(
    (Object.keys(CLAVES) as (keyof DatosContacto)[]).map((k) => [k, (datos[k] ?? "").trim()]),
  ) as Record<keyof DatosContacto, string>;
  for (const [k, v] of Object.entries(limpio)) {
    if (v.length > 300) throw new ContactoInvalido(`El campo ${k} admite hasta 300 caracteres.`);
  }
  if (limpio.whatsapp && !normalizarWhatsapp(limpio.whatsapp)) {
    throw new ContactoInvalido("El WhatsApp debe incluir el indicativo del país, por ejemplo +57 323 345 6845.");
  }
  if (limpio.correo && !correo(limpio.correo)) throw new ContactoInvalido("Revisa el correo.");
  if (limpio.mensajeWhatsapp.length > 200) throw new ContactoInvalido("El mensaje inicial admite hasta 200 caracteres.");

  await db.transaction().execute(async (trx) => {
    for (const k of Object.keys(CLAVES) as (keyof DatosContacto)[]) {
      const clave = CLAVES[k];
      if (!limpio[k]) {
        await trx.deleteFrom("configuracion").where("clave", "=", clave).execute();
        continue;
      }
      const valor = JSON.stringify(limpio[k]);
      await trx
        .insertInto("configuracion")
        .values({ clave, valor })
        .onConflict((oc) => oc.column("clave").doUpdateSet({ valor }))
        .execute();
    }
    await registrar(trx, { actorId, actorTipo: "usuario", accion: "contacto.actualizado" });
  });
}

// ---------------------------------------------------------------------------
// Parámetros de agenda y reserva (DPF: valores por defecto en la migración 0004).
// Se validan al leerlos: un valor inválido detiene la operación en vez de usar un supuesto.
// ---------------------------------------------------------------------------

export type ParametrosConfigurables = {
  granularidadMin: number;
  antelacionMin: number;
  horizonteDias: number;
  /** DPF: estado con el que nace una cita web. */
  estadoInicialCitaWeb: "confirmada" | "pendiente";
  /** DPF: pedir documento en la reserva web. */
  documentoObligatorio: boolean;
  /** DPF: valoraciones futuras activas permitidas por documento. */
  maxValoracionesFuturas: number;
};

const CLAVES_PARAMETROS = {
  granularidadMin: "agenda_granularidad_min",
  antelacionMin: "agenda_antelacion_min",
  horizonteDias: "agenda_horizonte_dias",
  estadoInicialCitaWeb: "cita_web_estado_inicial",
  documentoObligatorio: "reserva_documento_obligatorio",
  maxValoracionesFuturas: "reserva_max_valoraciones_futuras",
} as const satisfies Record<keyof ParametrosConfigurables, string>;

export const LIMITES_PARAMETROS = {
  granularidadMin: [5, 120],
  antelacionMin: [0, 60 * 24 * 14],
  horizonteDias: [0, 365],
  maxValoracionesFuturas: [1, 10],
} as const;

export class ConfiguracionInvalida extends Error {
  constructor(clave: string) {
    super(`Falta o es inválido el parámetro de configuración "${clave}".`);
  }
}

function entero(valor: unknown, clave: string, [min, max]: readonly [number, number]): number {
  if (typeof valor !== "number" || !Number.isInteger(valor) || valor < min || valor > max) {
    throw new ConfiguracionInvalida(clave);
  }
  return valor;
}

export function validarParametros(crudos: Record<string, unknown>): ParametrosConfigurables {
  const c = CLAVES_PARAMETROS;
  const estado = crudos[c.estadoInicialCitaWeb];
  if (estado !== "confirmada" && estado !== "pendiente") throw new ConfiguracionInvalida(c.estadoInicialCitaWeb);
  const documento = crudos[c.documentoObligatorio];
  if (typeof documento !== "boolean") throw new ConfiguracionInvalida(c.documentoObligatorio);
  return {
    granularidadMin: entero(crudos[c.granularidadMin], c.granularidadMin, LIMITES_PARAMETROS.granularidadMin),
    antelacionMin: entero(crudos[c.antelacionMin], c.antelacionMin, LIMITES_PARAMETROS.antelacionMin),
    horizonteDias: entero(crudos[c.horizonteDias], c.horizonteDias, LIMITES_PARAMETROS.horizonteDias),
    estadoInicialCitaWeb: estado,
    documentoObligatorio: documento,
    maxValoracionesFuturas: entero(
      crudos[c.maxValoracionesFuturas],
      c.maxValoracionesFuturas,
      LIMITES_PARAMETROS.maxValoracionesFuturas,
    ),
  };
}

export async function leerParametros(db: BaseDeDatos): Promise<ParametrosConfigurables> {
  const filas = await db
    .selectFrom("configuracion")
    .select(["clave", "valor"])
    .where("clave", "in", Object.values(CLAVES_PARAMETROS))
    .execute();
  return validarParametros(Object.fromEntries(filas.map((f) => [f.clave, f.valor])));
}

/** Guarda los parámetros (ya validados) desde el panel. */
export async function guardarParametros(db: BaseDeDatos, parametros: ParametrosConfigurables): Promise<void> {
  const validos = validarParametros(
    Object.fromEntries(
      (Object.keys(CLAVES_PARAMETROS) as (keyof ParametrosConfigurables)[]).map((k) => [CLAVES_PARAMETROS[k], parametros[k]]),
    ),
  );
  await db.transaction().execute(async (trx) => {
    for (const k of Object.keys(CLAVES_PARAMETROS) as (keyof ParametrosConfigurables)[]) {
      await trx
        .insertInto("configuracion")
        .values({ clave: CLAVES_PARAMETROS[k], valor: JSON.stringify(validos[k]) })
        .onConflict((oc) => oc.column("clave").doUpdateSet({ valor: JSON.stringify(validos[k]) }))
        .execute();
    }
  });
}

// ---------------------------------------------------------------------------
// Texto de autorización de tratamiento de datos. Lo redacta Fabio con su abogado.
// Un texto marcado como de demostración no habilita la reserva en producción.
// ---------------------------------------------------------------------------

export type TextoAutorizacion = { version: string; texto: string; demostracion: boolean };

export const CLAVE_TEXTO_AUTORIZACION = "texto_autorizacion_datos";

export async function leerTextoAutorizacion(db: BaseDeDatos): Promise<TextoAutorizacion | null> {
  const fila = await db
    .selectFrom("configuracion")
    .select("valor")
    .where("clave", "=", CLAVE_TEXTO_AUTORIZACION)
    .executeTakeFirst();
  const v = fila?.valor;
  if (typeof v !== "object" || v === null || Array.isArray(v)) return null;
  const { version, texto, demostracion } = v as Record<string, unknown>;
  if (typeof version !== "string" || !version.trim() || typeof texto !== "string" || texto.trim().length < 20) {
    return null;
  }
  return { version, texto, demostracion: demostracion === true };
}

/** La semilla de demostración marca la base; producción se niega a arrancar con esa marca. */
export async function baseTieneContenidoDemo(db: BaseDeDatos): Promise<boolean> {
  const fila = await db
    .selectFrom("configuracion")
    .select("valor")
    .where("clave", "=", CLAVE_CONTENIDO_DEMO)
    .executeTakeFirst();
  return fila?.valor === true;
}
