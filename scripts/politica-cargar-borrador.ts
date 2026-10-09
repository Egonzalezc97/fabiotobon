// Uso: npm run politica:cargar-borrador [-- --forzar]
// Carga en DESARROLLO los borradores de docs/: la política (configuración) y la autorización (versión "borrador-…").
// Se niega en producción. Sin --forzar no pisa una política existente ni crea versión si ya hay una autorización real.
// No es contenido de demostración: no va en db/seed/demo.sql ni en src/content/demo.
import { readFileSync } from "node:fs";
import path from "node:path";
import { cerrarDb, db } from "../src/lib/db";
import { esProduccion } from "../src/lib/despliegue";
import { cargarBorradoresLegales, leerPolitica } from "../src/modules/configuracion";

const leer = (archivo: string) => readFileSync(path.join(process.cwd(), "docs", archivo), "utf8");

try {
  const resultado = await cargarBorradoresLegales(
    db(),
    { politica: leer("politica-tratamiento-datos-borrador.md"), autorizacionMarkdown: leer("autorizacion-datos-borrador.md") },
    { forzar: process.argv.includes("--forzar"), produccion: esProduccion(process.env) },
  );
  const politica = await leerPolitica(db());
  console.log(
    resultado.politica === "cargada"
      ? `Política cargada. ${politica.publicable ? "Es publicable." : `No publicable: falta ${politica.faltantes.join(", ")}.`}`
      : "Ya había una política: no se tocó (usa --forzar para reemplazarla).",
  );
  console.log(
    resultado.autorizacion === "existente"
      ? "Ya había una autorización: no se creó versión (usa --forzar para crear una nueva)."
      : `Autorización cargada como versión ${resultado.autorizacion} (borrador: no habilita la reserva en producción).`,
  );
} catch (error) {
  console.error((error as Error).message);
  process.exitCode = 1;
} finally {
  await cerrarDb();
}
