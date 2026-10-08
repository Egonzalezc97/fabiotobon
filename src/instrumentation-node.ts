// Verificaciones de arranque. Solo se carga en el runtime de Node (ver instrumentation.ts).
import { esProduccion, verificarDespliegue } from "./lib/despliegue";

export async function verificarArranque() {
  try {
    verificarDespliegue(process.env);

    // Segunda barrera: aunque la variable esté apagada, una base con la semilla de demostración no arranca en producción.
    if (esProduccion(process.env)) {
      const { db } = await import("./lib/db");
      const { baseTieneContenidoDemo } = await import("./modules/configuracion");
      if (await baseTieneContenidoDemo(db())) {
        throw new Error("Arranque bloqueado: la base de producción tiene cargada la semilla de demostración.");
      }
    }
  } catch (error) {
    // Next no termina el proceso si el hook falla: quedaría vivo sin atender. Se sale explícitamente.
    console.error((error as Error).message);
    process.exit(1);
  }
}
