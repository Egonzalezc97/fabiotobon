import { cache } from "react";
import { obtenerContenido } from "@/content";
import { listarHorarioSemanal, resumirHorario } from "@/modules/agenda/horario";
import { baseTieneContenidoDemo, leerContacto } from "@/modules/configuracion";
import { listarServiciosLanding } from "@/modules/servicios";
import { db } from "./db";
import { env } from "./env";

/**
 * Datos del sitio público para una petición. `cache` evita repetir consultas entre el layout y la página.
 * El modo demostración se activa por variable o porque la base tiene la semilla de demostración:
 * así un dato ficticio nunca aparece sin la cinta.
 */
export const datosSitio = cache(async () => {
  const [contacto, demoEnBase, horario] = await Promise.all([
    leerContacto(db()),
    baseTieneContenidoDemo(db()),
    listarHorarioSemanal(db()),
  ]);
  const modoDemo = env().DEMO_CONTENT || demoEnBase;
  return { contacto, modoDemo, horario: resumirHorario(horario), contenido: obtenerContenido(modoDemo) };
});

export const serviciosLanding = cache(() => listarServiciosLanding(db()));
