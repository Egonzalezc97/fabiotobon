import { createHmac } from "node:crypto";
import { sql } from "kysely";
import { atenderPeticionAuth, type Auth } from "../src/lib/auth";
import { db as dbApp, type BaseDeDatos } from "../src/lib/db";

const ORIGEN = "http://localhost:3000";

/**
 * Borra los datos (no el esquema) entre pruebas y deja `configuracion` como recién migrada.
 * `auditoria` y los historiales se vacían saltándose su protección (TRUNCATE no dispara los triggers de fila).
 */
export async function limpiarDatos(db: BaseDeDatos) {
  await sql`
    ALTER TABLE auditoria DISABLE TRIGGER USER;
    TRUNCATE auditoria, usuario, "twoFactor", "session", "account", "verification", "user",
             servicio, configuracion, horario_laboral, intento_verificacion, verificacion_celular,
             solicitud_reserva, consentimiento, cita_evento, cita, bloqueo, paciente RESTART IDENTITY CASCADE;
    ALTER TABLE auditoria ENABLE TRIGGER USER;
    INSERT INTO configuracion SELECT * FROM _configuracion_base;
  `.execute(db);
}

export type Respuesta = { status: number; cuerpo: unknown; cookies: string[] };

/** Llama al manejador HTTP real de Better Auth, como lo haría el navegador. */
export async function llamar(auth: Auth, ruta: string, cuerpo?: unknown, cookie?: string): Promise<Respuesta> {
  const headers = new Headers({ origin: ORIGEN, "user-agent": "vitest", "x-forwarded-for": "203.0.113.7" });
  if (cuerpo !== undefined) headers.set("content-type", "application/json");
  if (cookie) headers.set("cookie", cookie);
  const respuesta = await atenderPeticionAuth(
    auth,
    dbApp(),
    new Request(`${ORIGEN}/api/auth${ruta}`, {
      method: cuerpo === undefined ? "GET" : "POST",
      headers,
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    }),
  );
  const texto = await respuesta.text();
  return {
    status: respuesta.status,
    cuerpo: texto ? JSON.parse(texto) : null,
    cookies: respuesta.headers.getSetCookie(),
  };
}

/** Une cookies previas con las nuevas (las nuevas reemplazan a las del mismo nombre). */
export function unirCookies(previas: string | undefined, nuevas: string[]): string {
  const mapa = new Map<string, string>();
  for (const par of (previas ?? "").split("; ").filter(Boolean)) {
    const [nombre] = par.split("=");
    if (nombre) mapa.set(nombre, par);
  }
  for (const c of nuevas) {
    const par = c.split(";")[0] ?? "";
    const [nombre, valor] = par.split("=");
    if (!nombre) continue;
    if (valor === "") mapa.delete(nombre);
    else mapa.set(nombre, par);
  }
  return [...mapa.values()].join("; ");
}

export function headersConCookie(cookie: string): Headers {
  return new Headers({ cookie });
}

// TOTP (RFC 6238) mínimo, para simular la aplicación autenticadora en las pruebas.
function base32(texto: string): Buffer {
  const alfabeto = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of texto.replace(/=+$/, "").toUpperCase()) {
    const i = alfabeto.indexOf(c);
    if (i < 0) throw new Error("base32 inválido");
    bits += i.toString(2).padStart(5, "0");
  }
  const bytes = bits.match(/.{8}/g) ?? [];
  return Buffer.from(bytes.map((b) => parseInt(b, 2)));
}

export function codigoTotp(totpURI: string, ahora = Date.now()): string {
  const secreto = new URL(totpURI).searchParams.get("secret");
  if (!secreto) throw new Error("URI sin secreto");
  const contador = Buffer.alloc(8);
  contador.writeBigUInt64BE(BigInt(Math.floor(ahora / 1000 / 30)));
  const hmac = createHmac("sha1", base32(secreto)).update(contador).digest();
  const desplazamiento = (hmac[hmac.length - 1] ?? 0) & 0xf;
  const numero = hmac.readUInt32BE(desplazamiento) & 0x7fffffff;
  return String(numero % 1_000_000).padStart(6, "0");
}
