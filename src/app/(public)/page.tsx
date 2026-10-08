import { connection } from "next/server";
import { FranjaUrgencias } from "@/components/publico/contacto";
import { casosGaleria, datosSitio, serviciosLanding } from "@/lib/sitio";
import { AntesDespues } from "./_secciones/antes-despues";
import { Contacto } from "./_secciones/contacto";
import { Hero } from "./_secciones/hero";
import { Servicios } from "./_secciones/servicios";

export default async function Inicio() {
  await connection();
  const [{ contenido, contacto, horario }, servicios, publicados] = await Promise.all([datosSitio(), serviciosLanding(), casosGaleria()]);

  return (
    <>
      <Hero contenido={contenido.hero} especialidad={contacto.especialidad} whatsapp={contacto.enlaceWhatsapp} horario={horario} />
      {contacto.urgencias && (
        <div className="mx-auto max-w-[84rem] px-5 pt-10 md:px-10 md:pt-14">
          <FranjaUrgencias urgencias={contacto.urgencias} />
        </div>
      )}
      <div className="h-20 md:h-28" aria-hidden="true" />
      <AntesDespues contenido={contenido.antesDespues} publicados={publicados} />
      <Servicios contenido={contenido.servicios} servicios={servicios} whatsapp={contacto.enlaceWhatsapp} />
      <Contacto contenido={contenido.contacto} contacto={contacto} horario={horario} />
    </>
  );
}
