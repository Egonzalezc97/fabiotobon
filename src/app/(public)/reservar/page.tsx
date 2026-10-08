import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { EnlaceWhatsapp } from "@/components/publico/enlaces";
import { datosSitio } from "@/lib/sitio";
import { cuposPublicos, estadoReservaPublica, serviciosReservables } from "@/modules/agenda/reserva-publica";
import { ultimoDiaReservable } from "@/modules/agenda/disponibilidad";
import { diasEntre, esFechaLocal, fechaLocal, formatearFechaLarga } from "@/modules/agenda/tiempo";
import { leerParametros } from "@/modules/configuracion";
import { Aviso, agruparPorDia, Contenedor, Encabezado, etiquetaHora, NoDisponible, SelectorDias } from "./_ui";
import { db, entornoReserva } from "./comun";

export const metadata: Metadata = { title: "Agendar valoración" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const AVISOS: Record<string, string> = {
  ocupado: "Ese horario se acaba de ocupar. Elige otro.",
  vencida: "Tu reserva anterior venció o no es válida. Empieza de nuevo.",
};

export default async function Reservar({ searchParams }: Props) {
  await connection();
  const sp = await searchParams;
  const { contacto } = await datosSitio();
  const estado = await estadoReservaPublica(db(), entornoReserva());
  if (!estado.disponible) return <NoDisponible whatsapp={contacto.enlaceWhatsapp} />;

  const servicios = await serviciosReservables(db());
  const servicio = servicios.find((s) => s.slug === sp.servicio) ?? servicios[0];
  if (!servicio) return <NoDisponible whatsapp={contacto.enlaceWhatsapp} />;

  const ahora = new Date();
  const { horizonteDias } = await leerParametros(db());
  const porDia = agruparPorDia(await cuposPublicos(db(), servicio, ahora));
  const dias = diasEntre(fechaLocal(ahora), ultimoDiaReservable(ahora, horizonteDias));
  const pedida = typeof sp.fecha === "string" && esFechaLocal(sp.fecha) && porDia.has(sp.fecha) ? sp.fecha : null;
  const fecha = pedida ?? [...porDia.keys()][0] ?? null;
  const cupos = fecha ? (porDia.get(fecha) ?? []) : [];
  const aviso = typeof sp.aviso === "string" ? AVISOS[sp.aviso] : undefined;
  const conServicio = (q: string) => `/reservar?${servicios.length > 1 ? `servicio=${servicio.slug}&` : ""}${q}`;

  return (
    <Contenedor>
      <Encabezado paso="Paso 1 de 3" titulo="Elige día y hora.">
        {servicio.nombre}, {servicio.duracionMin} minutos. Solo ves los horarios libres.
      </Encabezado>
      {aviso && <Aviso>{aviso}</Aviso>}

      {servicios.length > 1 && (
        <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 font-sans">
          {servicios.map((s) => (
            <li key={s.id}>
              <Link
                href={`/reservar?servicio=${s.slug}`}
                className={s.id === servicio.id ? "text-gris-800 underline underline-offset-[6px]" : "text-gris-600 hover:text-gris-800"}
              >
                {s.nombre}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-10">
        <SelectorDias dias={dias} conCupos={new Set(porDia.keys())} seleccionado={fecha} enlace={(f) => conServicio(`fecha=${f}`)} />
      </div>

      <div className="mt-8 max-w-3xl">
        {fecha === null ? (
          <p className="font-serif text-lg text-gris-600">No hay horarios disponibles en los próximos días. Escríbenos por WhatsApp.</p>
        ) : (
          <>
            <h2 className="font-sans text-sm uppercase tracking-[0.2em] text-gris-600 first-letter:uppercase">
              {formatearFechaLarga(cupos[0] ?? ahora)}
            </h2>
            <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
              {cupos.map((cupo) => (
                <li key={cupo.toISOString()}>
                  <Link
                    href={`/reservar/datos?servicio=${servicio.slug}&inicio=${encodeURIComponent(cupo.toISOString())}`}
                    className="block rounded-[2px] border border-gris-200 py-3 text-center font-sans tabular-nums text-gris-800 transition-colors duration-150 hover:border-azul hover:text-azul"
                  >
                    {etiquetaHora(cupo)}
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      <p className="mt-12 font-sans text-[0.9375rem] text-gris-600">
        ¿Ninguna hora te sirve? <EnlaceWhatsapp enlace={contacto.enlaceWhatsapp} className="text-gris-800" />
      </p>
    </Contenedor>
  );
}
