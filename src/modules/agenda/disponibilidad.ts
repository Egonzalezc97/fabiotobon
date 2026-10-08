import { diaSemana, diasEntre, fechaLocal, instante, minutosDelDia, sumarDias, type FechaLocal } from "./tiempo";

// Cálculo puro de cupos: horario laboral − bloqueos − citas activas, partido según la duración.
// Sin acceso a base de datos: recibe todo por parámetro para poder probarlo exhaustivamente.

/** Tramo de horario en minutos desde la medianoche (hora de Bogotá). */
export type Tramo = { inicioMin: number; finMin: number };
/** Clave: día ISO (1 = lunes … 7 = domingo). */
export type HorarioSemanal = Partial<Record<number, Tramo[]>>;
export type Intervalo = { inicio: Date; fin: Date };

export type ParametrosAgenda = {
  granularidadMin: number;
  antelacionMin: number;
  horizonteDias: number;
};

export type EntradaCupos = {
  desde: FechaLocal;
  hasta: FechaLocal;
  ahora: Date;
  horario: HorarioSemanal;
  /** Bloqueos y citas activas. Al público solo le llega el resultado, nunca esta lista. */
  ocupados: Intervalo[];
  duracionMin: number;
  parametros: ParametrosAgenda;
};

export function seCruzan(a: Intervalo, b: Intervalo): boolean {
  return a.inicio < b.fin && b.inicio < a.fin;
}

/** Ordena y une tramos contiguos o superpuestos (8:00–12:00 + 12:00–14:00 = 8:00–14:00). */
export function unirTramos(tramos: Tramo[]): Tramo[] {
  const ordenados = [...tramos].sort((a, b) => a.inicioMin - b.inicioMin);
  const unidos: Tramo[] = [];
  for (const t of ordenados) {
    const ultimo = unidos.at(-1);
    if (ultimo && t.inicioMin <= ultimo.finMin) ultimo.finMin = Math.max(ultimo.finMin, t.finMin);
    else unidos.push({ ...t });
  }
  return unidos;
}

/** Último día (en Bogotá) en que se puede reservar: hoy + horizonte. */
export function ultimoDiaReservable(ahora: Date, horizonteDias: number): FechaLocal {
  return sumarDias(fechaLocal(ahora), horizonteDias);
}

/**
 * Cupos disponibles entre `desde` y `hasta` (inclusive), como instantes de inicio.
 * - Se alinean al inicio de cada tramo, cada `granularidadMin`.
 * - El servicio completo debe caber dentro del tramo.
 * - No se cruzan con ningún intervalo ocupado.
 * - Empiezan como mínimo `antelacionMin` después de `ahora` y no pasan del último día del horizonte.
 */
export function calcularCupos(e: EntradaCupos): Date[] {
  const { granularidadMin, antelacionMin, horizonteDias } = e.parametros;
  if (granularidadMin <= 0 || e.duracionMin <= 0) throw new Error("Granularidad y duración deben ser positivas");

  const minimo = new Date(e.ahora.getTime() + antelacionMin * 60_000);
  const ultimoDia = ultimoDiaReservable(e.ahora, horizonteDias);
  const hasta = e.hasta < ultimoDia ? e.hasta : ultimoDia;
  const cupos: Date[] = [];

  for (const fecha of diasEntre(e.desde, hasta)) {
    for (const tramo of unirTramos(e.horario[diaSemana(fecha)] ?? [])) {
      for (let m = tramo.inicioMin; m + e.duracionMin <= tramo.finMin; m += granularidadMin) {
        const candidato = { inicio: instante(fecha, m), fin: instante(fecha, m + e.duracionMin) };
        if (candidato.inicio < minimo) continue;
        if (e.ocupados.some((o) => seCruzan(candidato, o))) continue;
        cupos.push(candidato.inicio);
      }
    }
  }
  return cupos;
}

/** ¿El intervalo cae completo dentro de un tramo del horario de su día? (no cruza la medianoche) */
export function dentroDelHorario(intervalo: Intervalo, horario: HorarioSemanal): boolean {
  const fecha = fechaLocal(intervalo.inicio);
  if (fechaLocal(new Date(intervalo.fin.getTime() - 1)) !== fecha) return false;
  const inicio = minutosDelDia(intervalo.inicio);
  const fin = inicio + (intervalo.fin.getTime() - intervalo.inicio.getTime()) / 60_000;
  return unirTramos(horario[diaSemana(fecha)] ?? []).some((t) => inicio >= t.inicioMin && fin <= t.finMin);
}

/** ¿`inicio` es exactamente uno de los cupos ofrecidos al público? Se usa para revalidar dentro de la transacción. */
export function esCupoValido(inicio: Date, e: Omit<EntradaCupos, "desde" | "hasta">): boolean {
  const fecha = fechaLocal(inicio);
  return calcularCupos({ ...e, desde: fecha, hasta: fecha }).some((c) => c.getTime() === inicio.getTime());
}
