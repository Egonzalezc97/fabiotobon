import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";

/** Zona horaria única del negocio. En la base todo se guarda en UTC. */
export const ZONA = "America/Bogota";

/** Fecha de calendario en Bogotá, "AAAA-MM-DD". */
export type FechaLocal = string;

const PATRON_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

function partes(fecha: FechaLocal): [number, number, number] {
  const m = PATRON_FECHA.exec(fecha);
  if (!m) throw new Error(`Fecha inválida: ${fecha}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

export function esFechaLocal(valor: string): boolean {
  const m = PATRON_FECHA.exec(valor);
  if (!m) return false;
  const [a, me, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const f = new Date(Date.UTC(a, me - 1, d));
  return f.getUTCFullYear() === a && f.getUTCMonth() === me - 1 && f.getUTCDate() === d;
}

/** Instante (UTC) que corresponde a `minutos` desde la medianoche de `fecha` en Bogotá. */
export function instante(fecha: FechaLocal, minutos = 0): Date {
  const [a, m, d] = partes(fecha);
  return new Date(new TZDate(a, m - 1, d, Math.floor(minutos / 60), minutos % 60, ZONA).getTime());
}

export function fechaLocal(momento: Date): FechaLocal {
  return format(new TZDate(momento.getTime(), ZONA), "yyyy-MM-dd");
}

export function horaLocal(momento: Date): string {
  return format(new TZDate(momento.getTime(), ZONA), "HH:mm");
}

export function minutosDelDia(momento: Date): number {
  const local = new TZDate(momento.getTime(), ZONA);
  return local.getHours() * 60 + local.getMinutes();
}

/** "HH:MM" o "HH:MM:SS" → minutos desde medianoche. */
export function aMinutos(hora: string): number {
  const [h = "0", m = "0"] = hora.split(":");
  return Number(h) * 60 + Number(m);
}

export function aHora(minutos: number): string {
  return `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
}

export function sumarDias(fecha: FechaLocal, dias: number): FechaLocal {
  const [a, m, d] = partes(fecha);
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
}

/** ISO 8601: 1 = lunes … 7 = domingo. */
export function diaSemana(fecha: FechaLocal): number {
  const [a, m, d] = partes(fecha);
  const dia = new Date(Date.UTC(a, m - 1, d)).getUTCDay();
  return dia === 0 ? 7 : dia;
}

export function lunesDeLaSemana(fecha: FechaLocal): FechaLocal {
  return sumarDias(fecha, 1 - diaSemana(fecha));
}

/** [medianoche de `fecha`, medianoche del día siguiente) en Bogotá. */
export function rangoDia(fecha: FechaLocal): { inicio: Date; fin: Date } {
  return { inicio: instante(fecha), fin: instante(sumarDias(fecha, 1)) };
}

export function diasEntre(desde: FechaLocal, hasta: FechaLocal): FechaLocal[] {
  const dias: FechaLocal[] = [];
  for (let f = desde; f <= hasta; f = sumarDias(f, 1)) dias.push(f);
  return dias;
}

const FECHA_LARGA = new Intl.DateTimeFormat("es-CO", {
  timeZone: ZONA,
  weekday: "long",
  day: "numeric",
  month: "long",
});

const FECHA_CORTA = new Intl.DateTimeFormat("es-CO", { timeZone: ZONA, weekday: "short", day: "numeric" });

/** "jueves, 8 de octubre" */
export function formatearFechaLarga(momento: Date): string {
  return FECHA_LARGA.format(momento);
}

export function formatearFechaCorta(momento: Date): string {
  return FECHA_CORTA.format(momento);
}

/** "8:30 a. m." en formato colombiano. */
export function formatearHora(momento: Date): string {
  return new Intl.DateTimeFormat("es-CO", { timeZone: ZONA, hour: "numeric", minute: "2-digit" }).format(momento);
}
