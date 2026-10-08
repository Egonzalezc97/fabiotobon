import type { CitaAgenda } from "./consultas";
import { unirTramos, type HorarioSemanal, type Intervalo } from "./disponibilidad";
import { diaSemana, instante, type FechaLocal } from "./tiempo";

// Armado de la vista de agenda del panel (puro, sin base de datos).

export type BloqueoAgenda = { id: string; inicio: Date; fin: Date; dia_completo: boolean; motivo: string };

export type ElementoDia =
  | { tipo: "cita"; inicio: Date; fin: Date; cita: CitaAgenda }
  | { tipo: "bloqueo"; inicio: Date; fin: Date; bloqueo: BloqueoAgenda }
  | { tipo: "libre"; inicio: Date; fin: Date };

const ACTIVOS = new Set(["pendiente", "confirmada"]);

/** Tramos de trabajo del día como instantes. */
export function tramosDelDia(fecha: FechaLocal, horario: HorarioSemanal): Intervalo[] {
  return unirTramos(horario[diaSemana(fecha)] ?? []).map((t) => ({ inicio: instante(fecha, t.inicioMin), fin: instante(fecha, t.finMin) }));
}

/** Resta intervalos ocupados a un intervalo libre. */
function restar(libre: Intervalo, ocupados: Intervalo[]): Intervalo[] {
  let piezas = [libre];
  for (const o of ocupados) {
    piezas = piezas.flatMap((p) => {
      if (o.fin <= p.inicio || o.inicio >= p.fin) return [p];
      const resto: Intervalo[] = [];
      if (o.inicio > p.inicio) resto.push({ inicio: p.inicio, fin: o.inicio });
      if (o.fin < p.fin) resto.push({ inicio: o.fin, fin: p.fin });
      return resto;
    });
  }
  return piezas;
}

/** Lista cronológica del día: citas, bloqueos y huecos libres dentro del horario. */
export function elementosDelDia(
  fecha: FechaLocal,
  horario: HorarioSemanal,
  citas: CitaAgenda[],
  bloqueos: BloqueoAgenda[],
): ElementoDia[] {
  const inicioDia = instante(fecha);
  const finDia = instante(fecha, 24 * 60);
  const enElDia = <T extends Intervalo>(x: T) => x.inicio < finDia && x.fin > inicioDia;
  const citasDia = citas.filter(enElDia);
  const bloqueosDia = bloqueos.filter(enElDia);
  const ocupados: Intervalo[] = [...citasDia.filter((c) => ACTIVOS.has(c.estado)), ...bloqueosDia];
  const libres = tramosDelDia(fecha, horario).flatMap((t) => restar(t, ocupados));

  const elementos: ElementoDia[] = [
    ...citasDia.map((c) => ({ tipo: "cita" as const, inicio: c.inicio, fin: c.fin, cita: c })),
    ...bloqueosDia.map((b) => ({ tipo: "bloqueo" as const, inicio: b.inicio, fin: b.fin, bloqueo: b })),
    ...libres.map((l) => ({ tipo: "libre" as const, ...l })),
  ];
  return elementos.sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
}

/** Rango de horas (minutos) que debe mostrar la cuadrícula: horario de la semana más citas fuera de él. */
export function rangoVisible(horario: HorarioSemanal, extremos: { inicioMin: number; finMin: number }[]): { desde: number; hasta: number } {
  const todos = [...Object.values(horario).flatMap((t) => t ?? []), ...extremos];
  if (todos.length === 0) return { desde: 7 * 60, hasta: 19 * 60 };
  const desde = Math.min(...todos.map((t) => t.inicioMin));
  const hasta = Math.max(...todos.map((t) => t.finMin));
  return { desde: Math.max(0, Math.floor(desde / 60) * 60), hasta: Math.min(24 * 60, Math.ceil(hasta / 60) * 60) };
}

export type ResumenDia = {
  citas: CitaAgenda[];
  /** Bloqueos que tocan el día sin cubrirlo completo. */
  bloqueosParciales: BloqueoAgenda[];
  /** Bloqueo que cubre el día entero (el primero, si hay varios). */
  bloqueoDiaCompleto: BloqueoAgenda | null;
};

/** Agrupa citas (por día de inicio) y bloqueos (por días que tocan) para la vista de mes. */
export function resumenPorDia(dias: FechaLocal[], citas: CitaAgenda[], bloqueos: BloqueoAgenda[]): Map<FechaLocal, ResumenDia> {
  const mapa = new Map<FechaLocal, ResumenDia>();
  for (const dia of dias) {
    const inicio = instante(dia);
    const fin = instante(dia, 24 * 60);
    const tocan = bloqueos.filter((b) => b.inicio < fin && b.fin > inicio);
    const completo = tocan.find((b) => b.inicio <= inicio && b.fin >= fin) ?? null;
    mapa.set(dia, {
      citas: citas.filter((c) => c.inicio >= inicio && c.inicio < fin).sort((a, b) => a.inicio.getTime() - b.inicio.getTime()),
      bloqueosParciales: tocan.filter((b) => b !== completo),
      bloqueoDiaCompleto: completo,
    });
  }
  return mapa;
}
