// Errores de dominio de la agenda. Los mensajes son para el panel; el sitio público usa los suyos.

export class ErrorAgenda extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = new.target.name;
  }
}

/** El horario ya no está libre (lo tomó otra cita) o dejó de ser un cupo válido. */
export class CupoNoDisponible extends ErrorAgenda {
  constructor() {
    super("Ese horario ya no está disponible.");
  }
}

export class ChocaConBloqueo extends ErrorAgenda {
  constructor() {
    super("El horario se cruza con un bloqueo de agenda.");
  }
}

export class FueraDeHorario extends ErrorAgenda {
  constructor() {
    super("El horario está fuera del horario laboral. Confírmalo para continuar.");
  }
}

export class CitaNoEncontrada extends ErrorAgenda {
  constructor() {
    super("La cita no existe.");
  }
}

export class CitaNoActiva extends ErrorAgenda {
  constructor() {
    super("Solo se pueden mover o cancelar citas pendientes o confirmadas.");
  }
}

export class TransicionInvalida extends ErrorAgenda {
  constructor(desde: string, hacia: string) {
    super(`No se puede pasar una cita de "${desde}" a "${hacia}".`);
  }
}

export class ServicioNoDisponible extends ErrorAgenda {
  constructor() {
    super("El servicio no está activo o no se puede reservar por este medio.");
  }
}

export type CitaAfectada = {
  id: string;
  inicio: Date;
  fin: Date;
  pacienteNombre: string;
  pacienteCelular: string | null;
  servicioNombre: string;
};

/** El bloqueo se cruza con citas activas que no tienen una decisión (reprogramar o cancelar). */
export class BloqueoConConflictos extends ErrorAgenda {
  constructor(readonly afectadas: CitaAfectada[]) {
    super("El bloqueo se cruza con citas. Decide qué hacer con cada una antes de guardarlo.");
  }
}

/** Código de PostgreSQL para violación de una restricción de exclusión. */
export const VIOLACION_EXCLUSION = "23P01";

export function esViolacionDeExclusion(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === VIOLACION_EXCLUSION;
}
