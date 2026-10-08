import { Pool } from "pg";
import { migrar } from "../src/lib/db/migraciones";

/** Recrea desde cero la base de pruebas y le aplica todas las migraciones. */
export default async function prepararBase() {
  const url = process.env.DATABASE_URL_TEST;
  if (!url) throw new Error("Falta DATABASE_URL_TEST (ver .env.example).");
  const nombre = new URL(url).pathname.slice(1);
  // Protección: estas pruebas borran la base. Nunca contra una que no sea de pruebas.
  if (!nombre.endsWith("_test")) throw new Error(`La base de pruebas debe terminar en _test (es "${nombre}").`);

  const pool = new Pool({ connectionString: url });
  try {
    await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
    await migrar(pool);
    // Copia de la configuración recién migrada (parámetros por defecto) para restaurarla entre pruebas.
    await pool.query("CREATE TABLE _configuracion_base AS SELECT * FROM configuracion");
  } finally {
    await pool.end();
  }
}
