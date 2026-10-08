/**
 * Textos editoriales de la landing. `null` = Fabio aún no lo entregó: la interfaz muestra "[PENDIENTE: …]".
 * Lo que no es contenido (nombres de secciones, etiquetas de botones) vive en los componentes.
 */
/** Versiones publicadas de una imagen de la galería (srcset AVIF y WebP). */
export type ImagenSitio = { ancho: number; alto: number; avif: string; webp: string };

export type CasoAntesDespues = {
  id: string;
  procedimiento: string;
  descripcion: string | null;
  /** Solo en casos publicados desde el panel; los de demostración usan bloques de color. */
  imagenes?: { antes: ImagenSitio; despues: ImagenSitio };
};

export type ContenidoLanding = {
  hero: {
    titular: string | null;
    entradilla: string | null;
  };
  antesDespues: {
    nota: string | null;
    casos: CasoAntesDespues[];
  };
  servicios: {
    entradilla: string | null;
    notaPrecios: string | null;
    cierre: string | null;
  };
  contacto: {
    entradilla: string | null;
  };
};
