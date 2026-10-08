import type { ContenidoLanding } from "../tipos";

// CONTENIDO DE DEMOSTRACIÓN. Textos ficticios redactados desde cero para revisar el diseño.
// Solo se usa con DEMO_CONTENT=true. Fabio no ha aprobado ninguna de estas frases.
export const contenidoDemo: ContenidoLanding = {
  hero: {
    titular: "Tu sonrisa, revisada con calma.",
    entradilla:
      "Empiezas con una valoración: revisamos tu caso, te explicamos las opciones y decides con toda la información.",
  },
  antesDespues: {
    nota: "Casos de demostración con imágenes de relleno. Las fotografías reales solo se publican con autorización escrita de cada paciente.",
    casos: [
      {
        id: "diseno-de-sonrisa",
        procedimiento: "Diseño de sonrisa",
        descripcion: "Forma y proporción planeadas antes de intervenir.",
      },
      {
        id: "blanqueamiento",
        procedimiento: "Blanqueamiento",
        descripcion: "Cambio de tono hecho en consultorio.",
      },
      {
        id: "rehabilitacion-oral",
        procedimiento: "Rehabilitación oral",
        descripcion: "Plan por etapas para volver a masticar con comodidad.",
      },
    ],
  },
  servicios: {
    entradilla: "Toda atención empieza con una valoración. Desde ahí definimos contigo qué hacer y en qué orden.",
    notaPrecios: "Los precios publicados son de referencia. El valor de tu tratamiento se define en la valoración.",
    cierre: "¿No sabes por dónde empezar? Empieza por la valoración.",
  },
  contacto: {
    entradilla: "Agenda en línea o escríbenos. Te respondemos en horario de atención.",
  },
};
