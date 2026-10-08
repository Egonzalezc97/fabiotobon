import type { BaseDeDatos } from "@/lib/db";

// Solo lectura del horario semanal para mostrarlo. El cálculo de cupos llega en la fase 2.

export type Tramo = { inicio: string; fin: string };
export type DiaHorario = { dia: number; tramos: Tramo[] };

export const NOMBRES_DIA = ["", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"] as const;

function hhmm(hora: string): string {
  // Postgres devuelve "08:00:00"; se muestra "8:00".
  const [h = "0", m = "00"] = hora.split(":");
  return `${Number(h)}:${m}`;
}

export async function listarHorarioSemanal(db: BaseDeDatos): Promise<DiaHorario[]> {
  const filas = await db
    .selectFrom("horario_laboral")
    .select(["dia_semana", "hora_inicio", "hora_fin"])
    .orderBy("dia_semana")
    .orderBy("hora_inicio")
    .execute();

  const dias = new Map<number, Tramo[]>();
  for (const f of filas) {
    const tramos = dias.get(f.dia_semana) ?? [];
    tramos.push({ inicio: hhmm(f.hora_inicio), fin: hhmm(f.hora_fin) });
    dias.set(f.dia_semana, tramos);
  }
  return [...dias].map(([dia, tramos]) => ({ dia, tramos }));
}

export type LineaHorario = { dias: string; horas: string };

/** Agrupa días consecutivos con el mismo horario: "lunes a viernes · 8:00–12:00 y 14:00–18:00". */
export function resumirHorario(semana: DiaHorario[]): LineaHorario[] {
  const lineas: { desde: number; hasta: number; horas: string }[] = [];
  for (const { dia, tramos } of semana) {
    const horas = tramos.map((t) => `${t.inicio}–${t.fin}`).join(" y ");
    const ultima = lineas.at(-1);
    if (ultima && ultima.horas === horas && ultima.hasta === dia - 1) ultima.hasta = dia;
    else lineas.push({ desde: dia, hasta: dia, horas });
  }
  return lineas.map(({ desde, hasta, horas }) => {
    const a = NOMBRES_DIA[desde] ?? "";
    const b = NOMBRES_DIA[hasta] ?? "";
    const dias = desde === hasta ? a : hasta === desde + 1 ? `${a} y ${b}` : `${a} a ${b}`;
    return { dias: dias.charAt(0).toUpperCase() + dias.slice(1), horas };
  });
}
