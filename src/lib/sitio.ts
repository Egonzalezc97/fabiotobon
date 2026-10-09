import { cache } from "react";
import { obtenerContenido } from "@/content";
import { listarHorarioSemanal, resumirHorario } from "@/modules/agenda/horario";
import { baseTieneContenidoDemo, leerContacto, leerPolitica } from "@/modules/configuracion";
import { casosPublicados } from "@/modules/galeria";
import { listarServiciosLanding } from "@/modules/servicios";
import { db } from "./db";
import { env } from "./env";

/**
 * Datos del sitio público para una petición. `cache` evita repetir consultas entre el layout y la página.
 * El modo demostración se activa por variable o porque la base tiene la semilla de demostración:
 * así un dato ficticio nunca aparece sin la cinta.
 */
export const datosSitio = cache(async () => {
  const [contacto, demoEnBase, horario, politica] = await Promise.all([
    leerContacto(db()),
    baseTieneContenidoDemo(db()),
    listarHorarioSemanal(db()),
    leerPolitica(db()),
  ]);
  const modoDemo = env().DEMO_CONTENT || demoEnBase;
  return {
    contacto,
    modoDemo,
    horario: resumirHorario(horario),
    contenido: obtenerContenido(modoDemo),
    /** Solo con la política completa y aprobada hay enlaces a /tratamiento-de-datos. */
    politicaPublicada: politica.publicable,
  };
});

export const serviciosLanding = cache(() => listarServiciosLanding(db()));

/** Casos de antes y después publicados desde el panel (con consentimiento). */
export const casosGaleria = cache(() => casosPublicados(db()));
