import type { Metadata } from "next";
import { connection } from "next/server";
import { CintaDemo } from "@/components/publico/cinta-demo";
import { WhatsappFlotante } from "@/components/publico/enlaces";
import { datosSitio } from "@/lib/sitio";
import { Cabecera } from "./_secciones/cabecera";
import { MedirCabecera } from "./_secciones/menu-movil";
import { Pie } from "./_secciones/pie";

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const { modoDemo, contacto } = await datosSitio();
  const titulo = contacto.especialidad ? `Fabio Tobón · ${contacto.especialidad}` : "Fabio Tobón Odontología";
  return {
    title: { absolute: titulo, template: "%s · Fabio Tobón" },
    // Un sitio con datos ficticios no se indexa.
    ...(modoDemo ? { robots: { index: false, follow: false } } : {}),
  };
}

export default async function LayoutPublico({ children }: { children: React.ReactNode }) {
  // Se renderiza por petición: servicios, horario y contacto se leen de la base en cada visita.
  await connection();
  const { modoDemo, contacto } = await datosSitio();

  return (
    <div className="bg-white">
      <a
        href="#contenido"
        className="sr-only z-[60] bg-white px-4 py-2 font-sans focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Saltar al contenido
      </a>
      {/* Cinta y navbar en un solo bloque fijo: no se montan una sobre otra. */}
      <div data-cabecera className="sticky top-0 z-50">
        {modoDemo && <CintaDemo />}
        <Cabecera />
        <MedirCabecera />
      </div>
      <main id="contenido">{children}</main>
      <Pie contacto={contacto} />
      <WhatsappFlotante enlace={contacto.enlaceWhatsapp} />
    </div>
  );
}
