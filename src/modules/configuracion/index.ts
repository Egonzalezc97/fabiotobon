import type { BaseDeDatos } from "@/lib/db";

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
  correo: string | null;
  registroProfesional: string | null;
};

const CLAVES = {
  direccion: "contacto_direccion",
  ciudad: "contacto_ciudad",
  telefono: "contacto_telefono",
  whatsapp: "contacto_whatsapp",
  correo: "contacto_correo",
  registroProfesional: "registro_profesional",
} as const satisfies Record<keyof DatosContacto, string>;

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

export async function leerContacto(db: BaseDeDatos): Promise<DatosContacto> {
  const filas = await db
    .selectFrom("configuracion")
    .select(["clave", "valor"])
    .where("clave", "in", Object.values(CLAVES))
    .execute();
  const valor = (clave: string) => filas.find((f) => f.clave === clave)?.valor;

  return {
    direccion: texto(valor(CLAVES.direccion)),
    ciudad: texto(valor(CLAVES.ciudad)),
    telefono: texto(valor(CLAVES.telefono)),
    whatsapp: normalizarWhatsapp(valor(CLAVES.whatsapp)),
    correo: correo(valor(CLAVES.correo)),
    registroProfesional: texto(valor(CLAVES.registroProfesional)),
  };
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
