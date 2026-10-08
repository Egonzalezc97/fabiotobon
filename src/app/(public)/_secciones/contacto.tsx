import { BloqueImagen } from "@/components/publico/bloque-imagen";
import { BotonAgendar, EnlaceWhatsapp } from "@/components/publico/enlaces";
import { Pendiente, TextoOPendiente } from "@/components/publico/pendiente";
import type { ContenidoLanding } from "@/content";
import type { LineaHorario } from "@/modules/agenda/horario";
import type { DatosContacto } from "@/modules/configuracion";

function Dato({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-gris-200 pt-4">
      <dt className="font-sans text-xs uppercase tracking-[0.2em] text-gris-600">{titulo}</dt>
      <dd className="mt-2 font-serif text-lg text-gris-800">{children}</dd>
    </div>
  );
}

export function Contacto({
  contenido,
  contacto,
  horario,
}: {
  contenido: ContenidoLanding["contacto"];
  contacto: DatosContacto;
  horario: LineaHorario[];
}) {
  return (
    <section id="contacto" aria-labelledby="titulo-contacto" className="scroll-mt-16">
      <div className="mx-auto grid max-w-[84rem] gap-14 px-5 py-20 md:px-10 md:py-28 lg:grid-cols-12 lg:gap-x-6">
        <div className="lg:col-span-6">
          <h2
            id="titulo-contacto"
            className="font-sans text-[clamp(2.25rem,5vw,3.75rem)] font-light leading-none tracking-[-0.01em]"
          >
            Contacto
          </h2>
          <p className="mt-6 max-w-md font-serif text-lg leading-relaxed text-gris-600">
            <TextoOPendiente texto={contenido.entradilla} dato="texto de contacto" />
          </p>

          <dl className="mt-12 grid gap-x-6 gap-y-8 sm:grid-cols-2">
            <Dato titulo="Dirección">
              <TextoOPendiente texto={contacto.direccion} dato="dirección" />
              <br />
              <span className="text-gris-600">
                <TextoOPendiente texto={contacto.ciudad} dato="ciudad" />
              </span>
            </Dato>
            <Dato titulo="Horario">
              {horario.length === 0 ? (
                <Pendiente dato="horario de atención" />
              ) : (
                <ul className="space-y-1">
                  {horario.map((l) => (
                    <li key={l.dias}>
                      {l.dias}
                      <br />
                      <span className="font-sans text-base tabular-nums text-gris-600">{l.horas}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Dato>
            <Dato titulo="Teléfono">
              {contacto.telefono ? (
                <a href={`tel:${contacto.telefono.replace(/[^\d+]/g, "")}`} className="underline-offset-4 hover:underline">
                  {contacto.telefono}
                </a>
              ) : (
                <Pendiente dato="teléfono" />
              )}
            </Dato>
            <Dato titulo="Correo">
              {contacto.correo ? (
                <a href={`mailto:${contacto.correo}`} className="underline-offset-4 hover:underline">
                  {contacto.correo}
                </a>
              ) : (
                <Pendiente dato="correo" />
              )}
            </Dato>
          </dl>

          <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-5">
            <BotonAgendar />
            <EnlaceWhatsapp numero={contacto.whatsapp} />
          </div>
        </div>

        <div className="lg:col-span-5 lg:col-start-8 lg:pt-24">
          <BloqueImagen proporcion="1 / 1" tono="medio" leyenda="Mapa · pendiente de dirección" />
        </div>
      </div>
    </section>
  );
}
