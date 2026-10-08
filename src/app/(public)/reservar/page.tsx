import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { EnlaceWhatsapp } from "@/components/publico/enlaces";
import { datosSitio } from "@/lib/sitio";

export const metadata: Metadata = { title: "Agendar valoración" };

// Marcador de la fase 1: la reserva en línea llega en la fase 2.
export default async function Reservar() {
  await connection();
  const { contacto } = await datosSitio();

  return (
    <section className="mx-auto grid max-w-[84rem] gap-10 px-5 pb-28 pt-10 md:px-10 lg:grid-cols-12 lg:gap-x-6 lg:pt-20">
      <div className="lg:col-span-7">
        <p className="font-sans text-xs uppercase tracking-[0.3em] text-gris-600">Agendar valoración</p>
        <h1 className="mt-6 font-sans text-[clamp(2.5rem,6vw,4.75rem)] font-light leading-[1.02] tracking-[-0.02em]">
          Muy pronto vas a poder agendar aquí.
        </h1>
        <p className="mt-8 max-w-md font-serif text-lg leading-relaxed text-gris-600">
          Mientras tanto, escríbenos por WhatsApp y te ayudamos a encontrar un horario.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-5">
          <EnlaceWhatsapp numero={contacto.whatsapp} className="text-gris-800" />
          <Link href="/" className="font-sans text-[0.9375rem] text-gris-600 underline-offset-[6px] hover:underline">
            Volver al inicio
          </Link>
        </div>
      </div>
    </section>
  );
}
