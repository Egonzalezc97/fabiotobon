// Estados de cita y sus transiciones. Sin dependencias: se puede usar también en componentes de cliente.

export type EstadoCita = "pendiente" | "confirmada" | "cancelada" | "cumplida" | "no_asistio";

export const ESTADOS_ACTIVOS = ["pendiente", "confirmada"] as const;

export const NOMBRES_ESTADO: Record<EstadoCita, string> = {
  pendiente: "Pendiente",
  confirmada: "Confirmada",
  cancelada: "Cancelada",
  cumplida: "Cumplida",
  no_asistio: "No asistió",
};

/** Transiciones permitidas. Una cita cancelada no se reactiva: se crea otra. */
export const TRANSICIONES: Record<EstadoCita, EstadoCita[]> = {
  pendiente: ["confirmada", "cancelada", "cumplida", "no_asistio"],
  confirmada: ["pendiente", "cancelada", "cumplida", "no_asistio"],
  cumplida: ["no_asistio"],
  no_asistio: ["cumplida"],
  cancelada: [],
};

export function transicionesPermitidas(estado: EstadoCita): EstadoCita[] {
  return TRANSICIONES[estado];
}
