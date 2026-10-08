import type { Metadata } from "next";
import { connection } from "next/server";
import { CintaDemo } from "@/components/publico/cinta-demo";
import { WhatsappFlotante } from "@/components/publico/enlaces";
import { datosSitio } from "@/lib/sitio";
import { Cabecera } from "./_secciones/cabecera";
import { Pie } from "./_secciones/pie";

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const { modoDemo } = await datosSitio();
  // Un sitio con datos ficticios no se indexa.
  return modoDemo ? { robots: { index: false, follow: false } } : {};
}

export default async function LayoutPublico({ children }: { children: React.ReactNode }) {
  // Se renderiza por petición: servicios, horario y contacto se leen de la base en cada visita.
  await connection();
  const { modoDemo, contacto } = await datosSitio();

  return (
    <div className="bg-white">
      <a
        href="#contenido"
        className="sr-only z-50 bg-white px-4 py-2 font-sans focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Saltar al contenido
      </a>
      {modoDemo && <CintaDemo />}
      <Cabecera />
      <main id="contenido">{children}</main>
      <Pie contacto={contacto} />
      <WhatsappFlotante numero={contacto.whatsapp} />
    </div>
  );
}
