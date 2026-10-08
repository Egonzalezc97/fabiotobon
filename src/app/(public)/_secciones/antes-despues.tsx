import { TextoOPendiente } from "@/components/publico/pendiente";
import { Pendiente } from "@/components/publico/pendiente";
import type { ContenidoLanding } from "@/content";
import { Galeria } from "./galeria";

export function AntesDespues({ contenido }: { contenido: ContenidoLanding["antesDespues"] }) {
  return (
    <section id="antes-y-despues" aria-labelledby="titulo-antes-despues" className="scroll-mt-16 bg-grafito text-gris-100">
      <div className="mx-auto max-w-[84rem] px-5 py-20 md:px-10 md:py-28">
        <div className="mb-12 grid gap-6 lg:grid-cols-12 lg:gap-x-6">
          <h2
            id="titulo-antes-despues"
            className="font-sans text-[clamp(2.25rem,5vw,3.75rem)] font-light leading-none tracking-[-0.01em] text-white lg:col-span-5"
          >
            Antes y después
          </h2>
          <p className="max-w-md self-end font-serif text-gris-400 lg:col-span-5 lg:col-start-8">
            <TextoOPendiente texto={contenido.nota} dato="nota sobre los casos publicados" />
          </p>
        </div>
        {contenido.casos.length > 0 ? (
          <Galeria casos={contenido.casos} />
        ) : (
          <p className="font-sans">
            <Pendiente dato="casos de antes y después con autorización del paciente" />
          </p>
        )}
      </div>
    </section>
  );
}
