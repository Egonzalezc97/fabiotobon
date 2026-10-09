import type { BaseDeDatos } from "@/lib/db";
import { formatearCelular, normalizarTelefono } from "@/lib/telefono";
import { registrar } from "@/modules/auditoria";

/**
 * Datos de contacto y del profesional. Viven en `configuracion` para que Fabio los edite sin desplegar.
 * Un valor ausente o inválido se devuelve como null y la interfaz muestra "[PENDIENTE: …]".
 */
export type DatosContacto = {
  /** Etiqueta del encabezado y título del sitio (p. ej. "Odontología integral"). */
  especialidad: string | null;
  direccion: string | null;
  ciudad: string | null;
  /** Cómo llegar en palabras; la usan el sitio, los mensajes y el agente. */
  referencia: string | null;
  telefono: string | null;
  /** Solo dígitos, con indicativo de país (p. ej. 57…), listo para wa.me. */
  whatsapp: string | null;
  /** Mensaje inicial que se escribe solo al abrir WhatsApp. */
  mensajeWhatsapp: string | null;
  correo: string | null;
  registroProfesional: string | null;
  /** URL completa del perfil. */
  instagram: string | null;
  facebook: string | null;
  urgenciasActiva: boolean;
  urgenciasTexto: string | null;
  /** E.164 (+57…). */
  urgenciasTelefono: string | null;
};

type CampoTexto = Exclude<keyof DatosContacto, "urgenciasActiva">;

const CLAVES = {
  especialidad: "especialidad",
  direccion: "contacto_direccion",
  ciudad: "contacto_ciudad",
  referencia: "contacto_referencia",
  telefono: "contacto_telefono",
  whatsapp: "contacto_whatsapp",
  mensajeWhatsapp: "contacto_whatsapp_mensaje",
  correo: "contacto_correo",
  registroProfesional: "registro_profesional",
  instagram: "redes_instagram",
  facebook: "redes_facebook",
  urgenciasTexto: "urgencias_texto",
  urgenciasTelefono: "urgencias_telefono",
} as const satisfies Record<CampoTexto, string>;

const CLAVE_URGENCIAS_ACTIVA = "urgencias_activa";

/** Longitud máxima por campo (el resto, 300). */
const MAXIMOS: Partial<Record<CampoTexto, number>> = {
  especialidad: 60,
  referencia: 200,
  mensajeWhatsapp: 200,
  urgenciasTexto: 60,
};

/** Enlace wa.me con el mensaje inicial (si hay). */
export function enlaceWhatsapp(numero: string, mensaje?: string | null): string {
  return mensaje ? `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}` : `https://wa.me/${numero}`;
}

/**
 * Búsqueda de Google Maps para "Cómo llegar". Se quitan "N.º", "No." y "#", que confunden la búsqueda:
 * "Carrera 23 N.º 47-80" + "Manizales" → query=Carrera+23+47-80+Manizales.
 */
export function enlaceComoLlegar(direccion: string, ciudad?: string | null): string {
  const consulta = [direccion.replace(/\bN\.?\s*[º°]\.?|\bNo\.|#/gi, " "), ciudad ?? ""]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(consulta).replace(/%20/g, "+")}`;
}

export const CLAVE_CONTENIDO_DEMO = "contenido_demo";

function texto(valor: unknown, maximo = 300): string | null {
  if (typeof valor !== "string") return null;
  const limpio = valor.trim();
  return limpio.length > 0 && limpio.length <= maximo ? limpio : null;
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

const REDES = {
  instagram: { dominio: "instagram.com", hosts: ["instagram.com", "www.instagram.com"] },
  facebook: { dominio: "facebook.com", hosts: ["facebook.com", "www.facebook.com", "m.facebook.com"] },
} as const;

/**
 * Perfil de una red como URL https del dominio oficial. Acepta la URL o solo el usuario ("dr.fabiotobon", "@dr.fabiotobon").
 * Cualquier otro dominio se rechaza: el sitio no enlaza a sitios de terceros desde este campo.
 */
export function normalizarRed(valor: unknown, red: keyof typeof REDES): string | null {
  const t = texto(valor);
  if (!t) return null;
  const { dominio, hosts } = REDES[red];
  const usuario = /^@?([A-Za-z0-9._]{1,60})$/.exec(t);
  if (usuario) return `https://${dominio}/${usuario[1]}`;
  try {
    const url = new URL(t);
    const ruta = url.pathname.replace(/\/+$/, "");
    if (url.protocol !== "https:" || !(hosts as readonly string[]).includes(url.hostname) || ruta.length < 2) return null;
    return `https://${dominio}${ruta}`;
  } catch {
    return null;
  }
}

/** "@usuario" a partir de la URL del perfil (último tramo de la ruta). */
export function usuarioDeRed(url: string): string {
  const tramo = new URL(url).pathname.split("/").filter(Boolean).at(-1) ?? "";
  return `@${decodeURIComponent(tramo)}`;
}

function enlaceLlamada(telefono: string | null): string | null {
  const numero = normalizarTelefono(telefono);
  return numero ? `tel:${numero}` : null;
}

export type UrgenciasPublicas = { texto: string; telefono: string; enlace: string };

export type ContactoPublico = DatosContacto & {
  enlaceWhatsapp: string | null;
  enlaceComoLlegar: string | null;
  /** tel:+57… si el teléfono es un número válido. */
  enlaceTelefono: string | null;
  /** "+57 323 345 6845": el número normalizado con formato legible (o el texto guardado si no es un número válido). */
  telefonoLegible: string | null;
  /** Solo si está activa y tiene texto y número válidos. */
  urgencias: UrgenciasPublicas | null;
};

function leerTextos(valor: (clave: string) => unknown): Omit<DatosContacto, "urgenciasActiva"> {
  const t = (k: CampoTexto) => texto(valor(CLAVES[k]), MAXIMOS[k]);
  return {
    especialidad: t("especialidad"),
    direccion: t("direccion"),
    ciudad: t("ciudad"),
    referencia: t("referencia"),
    telefono: t("telefono"),
    whatsapp: normalizarWhatsapp(valor(CLAVES.whatsapp)),
    mensajeWhatsapp: t("mensajeWhatsapp"),
    correo: correo(valor(CLAVES.correo)),
    registroProfesional: t("registroProfesional"),
    instagram: normalizarRed(valor(CLAVES.instagram), "instagram"),
    facebook: normalizarRed(valor(CLAVES.facebook), "facebook"),
    urgenciasTexto: t("urgenciasTexto"),
    urgenciasTelefono: normalizarTelefono(valor(CLAVES.urgenciasTelefono)),
  };
}

export async function leerContacto(db: BaseDeDatos): Promise<ContactoPublico> {
  const filas = await db
    .selectFrom("configuracion")
    .select(["clave", "valor"])
    .where("clave", "in", [...Object.values(CLAVES), CLAVE_URGENCIAS_ACTIVA])
    .execute();
  const valor = (clave: string) => filas.find((f) => f.clave === clave)?.valor;

  const datos = { ...leerTextos(valor), urgenciasActiva: valor(CLAVE_URGENCIAS_ACTIVA) === true };
  return {
    ...datos,
    enlaceWhatsapp: datos.whatsapp ? enlaceWhatsapp(datos.whatsapp, datos.mensajeWhatsapp) : null,
    enlaceComoLlegar: datos.direccion ? enlaceComoLlegar(datos.direccion, datos.ciudad) : null,
    enlaceTelefono: enlaceLlamada(datos.telefono),
    telefonoLegible: datos.telefono ? formatearCelular(normalizarTelefono(datos.telefono) ?? datos.telefono) : null,
    urgencias:
      datos.urgenciasActiva && datos.urgenciasTexto && datos.urgenciasTelefono
        ? {
            texto: datos.urgenciasTexto,
            telefono: formatearCelular(datos.urgenciasTelefono),
            enlace: `tel:${datos.urgenciasTelefono}`,
          }
        : null,
  };
}

/** Solo los datos guardados (sin los enlaces calculados), p. ej. para el formulario del panel. */
export function datosContacto(contacto: ContactoPublico): DatosContacto {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { enlaceWhatsapp, enlaceComoLlegar, enlaceTelefono, telefonoLegible, urgencias, ...datos } = contacto;
  return datos;
}

export class ContactoInvalido extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ContactoInvalido";
  }
}

export type EntradaContacto = Record<CampoTexto, string> & { urgenciasActiva: boolean };

const NOMBRES_CAMPO: Record<CampoTexto, string> = {
  especialidad: "La especialidad",
  direccion: "La dirección",
  ciudad: "La ciudad",
  referencia: "La referencia de ubicación",
  telefono: "El teléfono",
  whatsapp: "El WhatsApp",
  mensajeWhatsapp: "El mensaje inicial",
  correo: "El correo",
  registroProfesional: "El registro profesional",
  instagram: "Instagram",
  facebook: "Facebook",
  urgenciasTexto: "El texto de urgencias",
  urgenciasTelefono: "El número de urgencias",
};

/**
 * Guarda los datos de contacto desde el panel. Un campo vacío se borra (la web muestra "[PENDIENTE: …]").
 * Se guardan normalizados (redes como URL, números en E.164). Queda en auditoría.
 */
export async function guardarContacto(db: BaseDeDatos, datos: EntradaContacto, actorId: string): Promise<void> {
  const campos = Object.keys(CLAVES) as CampoTexto[];
  const limpio = Object.fromEntries(campos.map((k) => [k, (datos[k] ?? "").trim()])) as Record<CampoTexto, string>;
  for (const k of campos) {
    const maximo = MAXIMOS[k] ?? 300;
    if (limpio[k].length > maximo) throw new ContactoInvalido(`${NOMBRES_CAMPO[k]} admite hasta ${maximo} caracteres.`);
  }
  if (limpio.whatsapp && !normalizarWhatsapp(limpio.whatsapp)) {
    throw new ContactoInvalido("El WhatsApp debe incluir el indicativo del país, por ejemplo +57 323 345 6845.");
  }
  if (limpio.correo && !correo(limpio.correo)) throw new ContactoInvalido("Revisa el correo.");
  for (const red of ["instagram", "facebook"] as const) {
    if (limpio[red]) {
      const url = normalizarRed(limpio[red], red);
      if (!url) throw new ContactoInvalido(`${NOMBRES_CAMPO[red]}: escribe el usuario o la dirección de ${REDES[red].dominio}.`);
      limpio[red] = url;
    }
  }
  if (limpio.urgenciasTelefono) {
    const numero = normalizarTelefono(limpio.urgenciasTelefono);
    if (!numero) throw new ContactoInvalido("Revisa el número de urgencias, por ejemplo +57 323 345 6845.");
    limpio.urgenciasTelefono = numero;
  }
  if (datos.urgenciasActiva && (!limpio.urgenciasTexto || !limpio.urgenciasTelefono)) {
    throw new ContactoInvalido("Para mostrar urgencias escribe el texto y el número de llamada.");
  }

  await db.transaction().execute(async (trx) => {
    const guardar = (clave: string, valor: string) =>
      trx
        .insertInto("configuracion")
        .values({ clave, valor })
        .onConflict((oc) => oc.column("clave").doUpdateSet({ valor }))
        .execute();
    for (const k of campos) {
      if (!limpio[k]) {
        await trx.deleteFrom("configuracion").where("clave", "=", CLAVES[k]).execute();
        continue;
      }
      await guardar(CLAVES[k], JSON.stringify(limpio[k]));
    }
    await guardar(CLAVE_URGENCIAS_ACTIVA, JSON.stringify(datos.urgenciasActiva));
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

/** La semilla de demostración marca la base; producción se niega a arrancar con esa marca. */
export async function baseTieneContenidoDemo(db: BaseDeDatos): Promise<boolean> {
  const fila = await db
    .selectFrom("configuracion")
    .select("valor")
    .where("clave", "=", CLAVE_CONTENIDO_DEMO)
    .executeTakeFirst();
  return fila?.valor === true;
}

export * from "./textos-legales";
