/**
 * Textos editoriales de la landing. `null` = Fabio aún no lo entregó: la interfaz muestra "[PENDIENTE: …]".
 * Lo que no es contenido (nombres de secciones, etiquetas de botones) vive en los componentes.
 */
export type CasoAntesDespues = {
  id: string;
  procedimiento: string;
  descripcion: string | null;
};

export type ContenidoLanding = {
  hero: {
    etiqueta: string | null;
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
