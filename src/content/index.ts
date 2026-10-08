import { contenidoDemo } from "./demo/landing";
import type { ContenidoLanding } from "./tipos";

export type { CasoAntesDespues, ContenidoLanding, ImagenSitio } from "./tipos";

// Contenido real: vacío hasta que Fabio entregue textos. Cada null se muestra como "[PENDIENTE: …]".
const contenidoReal: ContenidoLanding = {
  hero: { titular: null, entradilla: null },
  antesDespues: { nota: null, casos: [] },
  servicios: { entradilla: null, notaPrecios: null, cierre: null },
  contacto: { entradilla: null },
};

/** Los textos ficticios solo salen con el modo demostración activo (y su cinta visible). */
export function obtenerContenido(modoDemo: boolean): ContenidoLanding {
  return modoDemo ? contenidoDemo : contenidoReal;
}
