import { registrar } from "@/modules/auditoria";
import type { BaseDeDatos } from "@/lib/db";
import { dentroDelHorario, type HorarioSemanal, type Tramo as TramoMinutos } from "./disponibilidad";
import { aHora, aMinutos } from "./tiempo";
import { enTransaccion, tomarCandadoAgenda, type Actor } from "./transaccion";

// Horario laboral semanal: lectura para mostrar (landing), en minutos para calcular cupos, y edición (panel).

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

/** Horario en minutos desde medianoche, por día ISO. Base del cálculo de cupos. */
export async function leerHorarioMinutos(db: BaseDeDatos): Promise<HorarioSemanal> {
  const filas = await db.selectFrom("horario_laboral").select(["dia_semana", "hora_inicio", "hora_fin"]).execute();
  const horario: HorarioSemanal = {};
  for (const f of filas) {
    (horario[f.dia_semana] ??= []).push({ inicioMin: aMinutos(f.hora_inicio), finMin: aMinutos(f.hora_fin) });
  }
  return horario;
}

export type CitaFueraDeHorario = { id: string; inicio: Date; fin: Date; pacienteNombre: string };

/**
 * Reemplaza el horario semanal completo. Si quedan citas futuras activas fuera del horario nuevo,
 * se devuelven como advertencia: siguen siendo válidas y Fabio decide si moverlas.
 * Los tramos superpuestos los rechaza la base (restricción horario_laboral_sin_solapes).
 */
export async function guardarHorario(
  db: BaseDeDatos,
  horario: HorarioSemanal,
  opciones: { actor: Actor; ahora?: Date },
): Promise<{ fueraDeHorario: CitaFueraDeHorario[] }> {
  return enTransaccion(db, async (trx) => {
    await tomarCandadoAgenda(trx);
    await trx.deleteFrom("horario_laboral").execute();
    const filas = Object.entries(horario).flatMap(([dia, tramos]) =>
      (tramos ?? []).map((t: TramoMinutos) => ({
        dia_semana: Number(dia),
        hora_inicio: aHora(t.inicioMin),
        hora_fin: aHora(t.finMin),
      })),
    );
    if (filas.length > 0) await trx.insertInto("horario_laboral").values(filas).execute();

    const futuras = await trx
      .selectFrom("cita")
      .innerJoin("paciente", "paciente.id", "cita.paciente_id")
      .select(["cita.id", "cita.inicio", "cita.fin", "paciente.nombre as pacienteNombre"])
      .where("cita.estado", "in", ["pendiente", "confirmada"])
      .where("cita.inicio", ">=", opciones.ahora ?? new Date())
      .orderBy("cita.inicio")
      .execute();

    await registrar(trx, {
      actorId: opciones.actor.id ?? null,
      actorTipo: opciones.actor.tipo === "usuario" ? "usuario" : "sistema",
      accion: "horario.actualizado",
      detalle: { tramos: filas.length },
    });
    return { fueraDeHorario: futuras.filter((c) => !dentroDelHorario(c, horario)) };
  });
}
