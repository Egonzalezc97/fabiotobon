import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import { sembrarGaleriaDemo } from "../src/content/demo/galeria";
import { almacenamiento } from "../src/lib/almacenamiento";
import type { DB } from "../src/lib/db";
import { cargarSemillaDemo } from "../src/lib/db/semilla";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Falta DATABASE_URL.");
  process.exit(1);
}

const pool = new Pool({ connectionString: url });
try {
  // 1) SQL (se niega en producción y sobre datos reales). 2) Imágenes de relleno del caso de galería.
  await cargarSemillaDemo(pool, process.env);
  const db = new Kysely<DB>({ dialect: new PostgresDialect({ pool }) });
  const creado = await sembrarGaleriaDemo(db, almacenamiento());
  console.log(`Semilla de demostración cargada${creado ? " (con caso de galería publicado)" : ""}. Recuerda DEMO_CONTENT=true para ver la cinta.`);
} catch (error) {
  console.error((error as Error).message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
