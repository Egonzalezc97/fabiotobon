import { connection } from "next/server";
import { datosSitio, serviciosLanding } from "@/lib/sitio";
import { AntesDespues } from "./_secciones/antes-despues";
import { Contacto } from "./_secciones/contacto";
import { Hero } from "./_secciones/hero";
import { Servicios } from "./_secciones/servicios";

export default async function Inicio() {
  await connection();
  const [{ contenido, contacto, horario }, servicios] = await Promise.all([datosSitio(), serviciosLanding()]);

  return (
    <>
      <Hero contenido={contenido.hero} whatsapp={contacto.enlaceWhatsapp} horario={horario} />
      <div className="h-20 md:h-28" aria-hidden="true" />
      <AntesDespues contenido={contenido.antesDespues} />
      <Servicios contenido={contenido.servicios} servicios={servicios} whatsapp={contacto.enlaceWhatsapp} />
      <Contacto contenido={contenido.contacto} contacto={contacto} horario={horario} />
    </>
  );
}
