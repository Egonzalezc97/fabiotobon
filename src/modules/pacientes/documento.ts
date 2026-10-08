// Documento de identidad: identifica al paciente (tipo + número).
// Validación básica de formato, igual a la restricción de la base (0003). Sin servicios externos.

export const TIPOS_DOCUMENTO = {
  CC: "Cédula de ciudadanía",
  TI: "Tarjeta de identidad",
  RC: "Registro civil",
  CE: "Cédula de extranjería",
  PA: "Pasaporte",
} as const;

export type TipoDocumento = keyof typeof TIPOS_DOCUMENTO;

const FORMATOS: Record<TipoDocumento, RegExp> = {
  CC: /^[0-9]{3,10}$/,
  TI: /^[0-9]{10,11}$/,
  RC: /^[0-9A-Z]{6,15}$/,
  CE: /^[0-9A-Z]{3,12}$/,
  PA: /^[0-9A-Z]{5,15}$/,
};

export type Documento = { tipo: TipoDocumento; numero: string };

export function esTipoDocumento(valor: unknown): valor is TipoDocumento {
  return typeof valor === "string" && Object.hasOwn(TIPOS_DOCUMENTO, valor);
}

/** Quita puntos, espacios y guiones y pasa a mayúsculas. Devuelve null si el formato no corresponde al tipo. */
export function normalizarDocumento(tipo: unknown, numero: unknown): Documento | null {
  if (!esTipoDocumento(tipo) || typeof numero !== "string") return null;
  const limpio = numero.replace(/[\s.\-]/g, "").toUpperCase();
  return FORMATOS[tipo].test(limpio) ? { tipo, numero: limpio } : null;
}

/** "CC 1.020.304.050" para mostrar en el panel. */
export function formatearDocumento(tipo: string | null, numero: string | null): string {
  if (!tipo || !numero) return "Sin documento";
  const legible = /^\d+$/.test(numero) ? Number(numero).toLocaleString("es-CO") : numero;
  return `${tipo} ${legible}`;
}
