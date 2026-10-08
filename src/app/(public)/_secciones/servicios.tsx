import { BotonAgendar, EnlaceWhatsapp } from "@/components/publico/enlaces";
import { Pendiente, TextoOPendiente } from "@/components/publico/pendiente";
import type { ContenidoLanding } from "@/content";
import { formatearDuracion, formatearPrecio, type ServicioPublico } from "@/modules/servicios";

export function Servicios({
  contenido,
  servicios,
  whatsapp,
}: {
  contenido: ContenidoLanding["servicios"];
  servicios: ServicioPublico[];
  whatsapp: string | null;
}) {
  const hayPrecios = servicios.some((s) => s.precioCop !== null);

  return (
    <section id="servicios" aria-labelledby="titulo-servicios" className="scroll-mt-16 bg-papel">
      <div className="mx-auto grid max-w-[84rem] gap-12 px-5 py-20 md:px-10 md:py-28 lg:grid-cols-12 lg:gap-x-6">
        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-16">
            <h2
              id="titulo-servicios"
              className="font-sans text-[clamp(2.25rem,5vw,3.75rem)] font-light leading-none tracking-[-0.01em]"
            >
              Servicios
            </h2>
            <p className="mt-6 max-w-sm font-serif text-lg leading-relaxed text-gris-600">
              <TextoOPendiente texto={contenido.entradilla} dato="introducción de servicios" />
            </p>
            {hayPrecios && (
              <p className="mt-6 max-w-sm font-serif text-sm italic text-gris-600">
                <TextoOPendiente texto={contenido.notaPrecios} dato="nota sobre precios" />
              </p>
            )}
          </div>
        </div>

        <div className="lg:col-span-8">
          {servicios.length === 0 ? (
            <Pendiente dato="servicios" />
          ) : (
            <ol className="border-b border-gris-200">
              {servicios.map((s, i) => (
                <li key={s.slug} className="border-t border-gris-200">
                  <details className="group">
                    <summary className="grid cursor-pointer list-none grid-cols-[2.5rem_1fr_auto] items-baseline gap-x-4 py-5 marker:hidden md:grid-cols-[3rem_1fr_6rem_8rem_1.5rem] [&::-webkit-details-marker]:hidden">
                      <span className="font-sans text-sm tabular-nums text-gris-600">{String(i + 1).padStart(2, "0")}</span>
                      <span className="font-sans text-xl text-gris-800 md:text-2xl">{s.nombre}</span>
                      <span className="font-sans text-sm tabular-nums text-gris-600 md:text-right">
                        {formatearDuracion(s.duracionMin)}
                      </span>
                      <span className="col-start-2 font-sans text-sm tabular-nums text-gris-800 md:col-start-auto md:text-right">
                        {s.precioCop !== null ? formatearPrecio(s.precioCop) : ""}
                      </span>
                      <span
                        aria-hidden="true"
                        className="hidden text-right font-sans text-gris-600 transition-transform duration-150 group-open:rotate-45 md:block"
                      >
                        +
                      </span>
                    </summary>
                    <div className="grid grid-cols-[2.5rem_1fr] gap-x-4 pb-7 md:grid-cols-[3rem_1fr_15.5rem]">
                      <p className="col-start-2 max-w-xl font-serif leading-relaxed text-gris-600">
                        {s.descripcion || <Pendiente dato="descripción del servicio" />}
                      </p>
                    </div>
                  </details>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <div className="border-t border-gris-200 bg-white">
        <div className="mx-auto flex max-w-[84rem] flex-col gap-8 px-5 py-12 md:px-10 lg:flex-row lg:items-center lg:justify-between">
          <p className="max-w-2xl font-sans text-[clamp(1.5rem,3vw,2.25rem)] font-light leading-tight">
            <TextoOPendiente texto={contenido.cierre} dato="llamado a la acción" />
          </p>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-5">
            <BotonAgendar />
            <EnlaceWhatsapp enlace={whatsapp} />
          </div>
        </div>
      </div>
    </section>
  );
}
