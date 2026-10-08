import { Pool } from "pg";
import { cargarSemillaDemo } from "../src/lib/db/semilla";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Falta DATABASE_URL.");
  process.exit(1);
}

const pool = new Pool({ connectionString: url });
try {
  await cargarSemillaDemo(pool, process.env);
  console.log("Semilla de demostración cargada. Recuerda DEMO_CONTENT=true para ver la cinta.");
} catch (error) {
  console.error((error as Error).message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
