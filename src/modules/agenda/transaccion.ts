import { sql } from "kysely";
import type { BaseDeDatos } from "@/lib/db";

// Número fijo y arbitrario para el candado de la agenda (distinto del de migraciones).
const LLAVE_AGENDA = 7_412_027;

/** Ejecuta `fn` en una transacción, o dentro de la actual si ya hay una (las operaciones se componen). */
export async function enTransaccion<T>(db: BaseDeDatos, fn: (trx: BaseDeDatos) => Promise<T>): Promise<T> {
  if (db.isTransaction) return fn(db);
  return db.transaction().execute(fn);
}

/**
 * Serializa las escrituras de agenda (citas, bloqueos, horario) hasta el fin de la transacción.
 * Cita contra cita ya lo garantiza la restricción de exclusión; este candado cubre lo que una
 * restricción no puede cruzar: cita contra bloqueo y contra horario. Es reentrante en la misma sesión.
 */
export async function tomarCandadoAgenda(trx: BaseDeDatos): Promise<void> {
  if (!trx.isTransaction) throw new Error("El candado de agenda solo se toma dentro de una transacción");
  await sql`SELECT pg_advisory_xact_lock(${LLAVE_AGENDA})`.execute(trx);
}

export type Actor = { tipo: "usuario" | "paciente" | "sistema"; id?: string | null };
