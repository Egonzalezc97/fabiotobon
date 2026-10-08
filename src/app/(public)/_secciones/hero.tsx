import { BloqueImagen } from "@/components/publico/bloque-imagen";
import { BotonAgendar, EnlaceWhatsapp } from "@/components/publico/enlaces";
import { Pendiente, TextoOPendiente } from "@/components/publico/pendiente";
import type { ContenidoLanding } from "@/content";
import type { LineaHorario } from "@/modules/agenda/horario";

export function Hero({
  contenido,
  whatsapp,
  horario,
}: {
  contenido: ContenidoLanding["hero"];
  whatsapp: string | null;
  horario: LineaHorario[];
}) {
  return (
    <section aria-labelledby="titulo-hero" className="mx-auto max-w-[84rem] px-5 md:px-10">
      <div className="grid gap-y-12 pt-6 lg:grid-cols-12 lg:gap-x-6 lg:pt-10">
        <div className="relative z-10 lg:col-span-6 lg:flex lg:flex-col lg:justify-center lg:pb-16">
          <p className="font-sans text-xs uppercase tracking-[0.3em] text-gris-600">
            <TextoOPendiente texto={contenido.etiqueta} dato="etiqueta del encabezado" />
          </p>
          <h1
            id="titulo-hero"
            className="mt-6 font-sans text-[clamp(2.75rem,7.2vw,6.25rem)] font-light leading-[0.98] tracking-[-0.02em] text-gris-800 lg:-mr-[28%]"
          >
            {contenido.titular ?? <Pendiente dato="titular principal" />}
          </h1>
          <p className="mt-8 max-w-md font-serif text-lg leading-relaxed text-gris-600">
            <TextoOPendiente texto={contenido.entradilla} dato="propuesta de valor" />
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-5">
            <BotonAgendar />
            <EnlaceWhatsapp numero={whatsapp} className="text-gris-800" />
          </div>
        </div>

        <div className="-mx-5 md:-mx-10 lg:col-span-6 lg:mx-0 lg:mr-[calc(50%-50vw)]">
          <BloqueImagen proporcion="4 / 5" leyenda="Fotografía pendiente · 4:5" className="lg:max-h-[52rem]" />
        </div>
      </div>

      <div className="mt-10 flex flex-col gap-2 border-t border-gris-200 py-5 font-sans text-sm text-gris-600 sm:flex-row sm:flex-wrap sm:gap-x-10">
        <span className="uppercase tracking-[0.2em] text-gris-800">Horario</span>
        {horario.length === 0 ? (
          <Pendiente dato="horario de atención" />
        ) : (
          horario.map((l) => (
            <span key={l.dias}>
              {l.dias} <span className="tabular-nums">{l.horas}</span>
            </span>
          ))
        )}
      </div>
    </section>
  );
}
