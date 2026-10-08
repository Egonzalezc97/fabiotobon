import { Pool } from "pg";
import { migrar } from "../src/lib/db/migraciones";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Falta DATABASE_URL.");
  process.exit(1);
}

const pool = new Pool({ connectionString: url });
try {
  const { aplicadas, yaAplicadas } = await migrar(pool);
  console.log(`Migraciones ya aplicadas: ${yaAplicadas.length}`);
  console.log(aplicadas.length > 0 ? `Aplicadas ahora: ${aplicadas.join(", ")}` : "No hay migraciones pendientes.");
} catch (error) {
  console.error((error as Error).message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
