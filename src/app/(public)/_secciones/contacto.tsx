import { BloqueImagen } from "@/components/publico/bloque-imagen";
import { FranjaUrgencias, hayRedes, hayUbicacion, Redes, Ubicacion } from "@/components/publico/contacto";
import { BotonAgendar, EnlaceWhatsapp } from "@/components/publico/enlaces";
import { marcadoresVisibles, Pendiente, TextoOPendiente } from "@/components/publico/pendiente";
import type { ContenidoLanding } from "@/content";
import type { LineaHorario } from "@/modules/agenda/horario";
import type { ContactoPublico } from "@/modules/configuracion";

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
  contacto: ContactoPublico;
  horario: LineaHorario[];
}) {
  return (
    <section id="contacto" aria-labelledby="titulo-contacto" className="ancla">
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
            {hayUbicacion(contacto) && (
              <Dato titulo="Dirección">
                <Ubicacion contacto={contacto} />
              </Dato>
            )}
            {(horario.length > 0 || marcadoresVisibles()) && (
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
            )}
            {/* Opcionales: si están vacíos no se muestran. */}
            {contacto.telefono && (
              <Dato titulo="Teléfono">
                <a href={contacto.enlaceTelefono ?? undefined} className="underline-offset-4 hover:underline">
                  {contacto.telefonoLegible}
                </a>
              </Dato>
            )}
            {contacto.correo && (
              <Dato titulo="Correo">
                <a href={`mailto:${contacto.correo}`} className="break-all underline-offset-4 hover:underline">
                  {contacto.correo}
                </a>
              </Dato>
            )}
            {hayRedes(contacto) && (
              <Dato titulo="Redes">
                <Redes contacto={contacto} className="-my-2" />
              </Dato>
            )}
          </dl>

          {contacto.urgencias && <FranjaUrgencias urgencias={contacto.urgencias} className="mt-12" />}

          <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-5">
            <BotonAgendar />
            <EnlaceWhatsapp enlace={contacto.enlaceWhatsapp} />
          </div>
        </div>

        <div className="lg:col-span-5 lg:col-start-8 lg:pt-24">
          <BloqueImagen proporcion="1 / 1" tono="medio" leyenda="Fotografía del consultorio pendiente · 1:1" />
        </div>
      </div>
    </section>
  );
}
