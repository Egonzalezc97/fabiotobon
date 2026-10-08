import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Pool } from "pg";
import { esProduccion } from "../despliegue";

export const ARCHIVO_SEMILLA_DEMO = path.resolve(process.cwd(), "db/seed/demo.sql");

/**
 * Carga la semilla de demostración en una transacción.
 * Se niega en producción y sobre una base que ya tenga servicios sin la marca de demostración (datos reales).
 */
export async function cargarSemillaDemo(pool: Pool, variables: Record<string, string | undefined>): Promise<void> {
  if (esProduccion(variables)) throw new Error("La semilla de demostración no se carga en producción.");

  const sql = await readFile(ARCHIVO_SEMILLA_DEMO, "utf8");
  const cliente = await pool.connect();
  try {
    await cliente.query("BEGIN");
    const { rows } = await cliente.query<{ servicios: number; demo: boolean }>(`
      SELECT (SELECT count(*)::int FROM servicio) AS servicios,
             coalesce((SELECT valor = 'true'::jsonb FROM configuracion WHERE clave = 'contenido_demo'), false) AS demo`);
    const estado = rows[0];
    if (estado && estado.servicios > 0 && !estado.demo) {
      throw new Error("La base ya tiene servicios que no son de demostración. No se carga la semilla.");
    }
    await cliente.query(sql);
    await cliente.query("COMMIT");
  } catch (error) {
    await cliente.query("ROLLBACK");
    throw error;
  } finally {
    cliente.release();
  }
}
