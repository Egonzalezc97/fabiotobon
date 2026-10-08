import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { Pool } from "pg";

export const CARPETA_MIGRACIONES = path.resolve(process.cwd(), "db/migrations");

const PATRON_ARCHIVO = /^\d{4}_[a-z0-9_]+\.sql$/;
// Número arbitrario y fijo: evita que dos procesos migren a la vez.
const LLAVE_BLOQUEO = 7_412_026;

export type ResultadoMigracion = { aplicadas: string[]; yaAplicadas: string[] };

function sumaDeVerificacion(sql: string): string {
  // Normaliza saltos de línea: git en Windows puede convertir LF en CRLF.
  return createHash("sha256").update(sql.replace(/\r\n/g, "\n")).digest("hex");
}

export async function leerMigraciones(carpeta = CARPETA_MIGRACIONES) {
  const archivos = (await readdir(carpeta)).filter((a) => a.endsWith(".sql")).sort();
  const invalidos = archivos.filter((a) => !PATRON_ARCHIVO.test(a));
  if (invalidos.length > 0) {
    throw new Error(`Nombres de migración inválidos (formato 0001_nombre.sql): ${invalidos.join(", ")}`);
  }
  return Promise.all(
    archivos.map(async (nombre) => {
      const sql = await readFile(path.join(carpeta, nombre), "utf8");
      return { nombre, sql, checksum: sumaDeVerificacion(sql) };
    }),
  );
}

/**
 * Aplica en orden las migraciones pendientes, cada una en su propia transacción.
 * Falla si una migración ya aplicada cambió: las migraciones aplicadas no se editan, se agrega una nueva.
 */
export async function migrar(pool: Pool, carpeta = CARPETA_MIGRACIONES): Promise<ResultadoMigracion> {
  const migraciones = await leerMigraciones(carpeta);
  const cliente = await pool.connect();
  try {
    await cliente.query("SELECT pg_advisory_lock($1)", [LLAVE_BLOQUEO]);
    await cliente.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        nombre       text PRIMARY KEY,
        checksum     text NOT NULL,
        aplicada_en  timestamptz NOT NULL DEFAULT now()
      )`);
    const { rows } = await cliente.query<{ nombre: string; checksum: string }>(
      "SELECT nombre, checksum FROM schema_migrations",
    );
    const aplicadasAntes = new Map(rows.map((r) => [r.nombre, r.checksum]));

    const desconocidas = [...aplicadasAntes.keys()].filter((n) => !migraciones.some((m) => m.nombre === n));
    if (desconocidas.length > 0) {
      throw new Error(`La base tiene migraciones que no existen en el repositorio: ${desconocidas.join(", ")}`);
    }

    const resultado: ResultadoMigracion = { aplicadas: [], yaAplicadas: [] };
    for (const m of migraciones) {
      const previa = aplicadasAntes.get(m.nombre);
      if (previa !== undefined) {
        if (previa !== m.checksum) {
          throw new Error(`La migración ${m.nombre} cambió después de aplicarse. Crea una migración nueva.`);
        }
        resultado.yaAplicadas.push(m.nombre);
        continue;
      }
      try {
        await cliente.query("BEGIN");
        await cliente.query(m.sql);
        await cliente.query("INSERT INTO schema_migrations (nombre, checksum) VALUES ($1, $2)", [m.nombre, m.checksum]);
        await cliente.query("COMMIT");
      } catch (error) {
        await cliente.query("ROLLBACK");
        throw new Error(`Falló la migración ${m.nombre}: ${(error as Error).message}`, { cause: error });
      }
      resultado.aplicadas.push(m.nombre);
    }
    return resultado;
  } finally {
    await cliente.query("SELECT pg_advisory_unlock($1)", [LLAVE_BLOQUEO]).catch(() => undefined);
    cliente.release();
  }
}
