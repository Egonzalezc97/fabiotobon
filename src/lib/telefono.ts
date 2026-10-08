import { parsePhoneNumberFromString } from "libphonenumber-js/min";

/**
 * Normaliza un celular a E.164 (+573001234567). Colombia por defecto.
 * En Colombia exige número móvil (empieza por 3): el código se envía por WhatsApp o SMS.
 */
export function normalizarCelular(texto: unknown): string | null {
  if (typeof texto !== "string") return null;
  const numero = parsePhoneNumberFromString(texto.trim(), "CO");
  if (!numero?.isValid()) return null;
  if (numero.country === "CO" && !numero.nationalNumber.startsWith("3")) return null;
  return numero.number;
}

/** "•••• 4567" para mostrar sin exponer el número completo. */
export function enmascararCelular(e164: string): string {
  return `•••• ${e164.slice(-4)}`;
}

/** "+57 300 123 4567" para el panel. */
export function formatearCelular(e164: string | null): string {
  if (!e164) return "";
  return parsePhoneNumberFromString(e164)?.formatInternational() ?? e164;
}
