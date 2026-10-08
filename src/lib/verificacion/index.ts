import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { esProduccion } from "../despliegue";

/**
 * Emisor del código de verificación. En la fase 2 solo existe el de desarrollo (consola).
 * El emisor real (WhatsApp vía Twilio o correo) se conecta en la fase 3 implementando esta interfaz.
 */
export interface EmisorCodigo {
  readonly nombre: string;
  enviar(celular: string, codigo: string): Promise<void>;
}

export class EmisorNoPermitido extends Error {
  constructor() {
    super("El emisor de desarrollo no puede usarse en producción.");
  }
}

/** Escribe el código en la consola del servidor. Se niega a funcionar en producción. */
export const emisorDesarrollo: EmisorCodigo = {
  nombre: "desarrollo",
  async enviar(celular, codigo) {
    if (esProduccion(process.env)) throw new EmisorNoPermitido();
    console.info(`[verificación · desarrollo] Código para ${celular}: ${codigo}`);
  },
};

/**
 * Emisor configurado. En producción devuelve null mientras no haya emisor real (fase 3):
 * la reserva pública queda desactivada con mensaje y enlace a WhatsApp.
 */
export function obtenerEmisor(variables: Record<string, string | undefined> = process.env): EmisorCodigo | null {
  if (esProduccion(variables)) return null;
  return emisorDesarrollo;
}

export function generarCodigo(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** HMAC del código ligado a la verificación: el mismo código en otra verificación da otro hash. */
export function hmacCodigo(secreto: string, verificacionId: string, codigo: string): string {
  return createHmac("sha256", secreto).update(`${verificacionId}:${codigo}`).digest("hex");
}

export function codigoCoincide(secreto: string, verificacionId: string, codigo: string, hmacGuardado: string): boolean {
  if (!/^\d{6}$/.test(codigo)) return false;
  const a = Buffer.from(hmacCodigo(secreto, verificacionId, codigo), "hex");
  const b = Buffer.from(hmacGuardado, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
