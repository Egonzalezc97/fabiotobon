import { BloqueImagen } from "@/components/publico/bloque-imagen";
import { BotonAgendar, EnlaceWhatsapp } from "@/components/publico/enlaces";
import { Pendiente, TextoOPendiente } from "@/components/publico/pendiente";
import type { ContenidoLanding } from "@/content";
import type { LineaHorario } from "@/modules/agenda/horario";

/*
 * Composición: la sección ocupa todo el ancho y es un contenedor de consultas (@container).
 * El texto se alinea con el resto de la página calculando su margen con `cqw` (ancho de la sección,
 * sin barra de desplazamiento); el bloque de imagen llega solo hasta el borde derecho porque su
 * columna termina ahí. No se usa `100vw`: incluye la barra de desplazamiento y provoca scroll horizontal.
 * El margen replica el contenedor general: max-w 84rem con px-5 (móvil) y px-10 (md en adelante).
 */
const MARGEN_IZQUIERDO = "md:pl-[max(2.5rem,calc((100cqw-84rem)/2+2.5rem))]";

function Horario({ horario }: { horario: LineaHorario[] }) {
  return (
    <div className="flex flex-col gap-2 border-t border-gris-200 pt-5 font-sans text-sm text-gris-600 sm:flex-row sm:flex-wrap sm:gap-x-8">
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
  );
}

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
    <section aria-labelledby="titulo-hero" className="@container">
      <div className="md:grid md:grid-cols-[minmax(0,1fr)_50%] lg:grid-cols-[minmax(0,1fr)_min(42%,36rem)] md:items-stretch">
        <div className={`relative z-10 flex flex-col px-5 pt-6 md:pr-10 md:pt-4 ${MARGEN_IZQUIERDO}`}>
          <div className="md:my-auto md:py-8">
            <p className="font-sans text-xs uppercase tracking-[0.3em] text-gris-600">
              <TextoOPendiente texto={contenido.etiqueta} dato="etiqueta del encabezado" />
            </p>
            <h1
              id="titulo-hero"
              className="mt-6 font-sans text-[clamp(2.75rem,6.4cqw,6rem)] font-light leading-[0.98] tracking-[-0.02em] text-gris-800 md:-mr-[22%]"
            >
              {contenido.titular ?? <Pendiente dato="titular principal" />}
            </h1>
            <p className="mt-7 max-w-md font-serif text-lg leading-relaxed text-gris-600">
              <TextoOPendiente texto={contenido.entradilla} dato="propuesta de valor" />
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-x-8 gap-y-5">
              <BotonAgendar />
              <EnlaceWhatsapp numero={whatsapp} className="text-gris-800" />
            </div>
          </div>
          {/* Desde lg el horario cierra la columna a la altura del borde inferior del bloque. */}
          <div className="hidden lg:block">
            <Horario horario={horario} />
          </div>
        </div>

        <div className="mt-12 md:mt-0">
          <BloqueImagen proporcion="4 / 5" leyenda="Fotografía pendiente · 4:5" />
        </div>
      </div>

      <div className="px-5 pt-8 md:px-10 lg:hidden">
        <Horario horario={horario} />
      </div>
    </section>
  );
}
