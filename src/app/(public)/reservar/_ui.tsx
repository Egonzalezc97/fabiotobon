import Link from "next/link";
import { EnlaceWhatsapp } from "@/components/publico/enlaces";
import { formatearPrecio, formatearDuracion } from "@/modules/servicios";
import type { CalendarioMes } from "@/components/publico/calendario-mes";
import {
  fechaLocal,
  formatearFechaLarga,
  formatearHora,
  horaLocal,
  instante as aInstante,
  mesDe,
  nombreMes,
  semanasDelMes,
  sumarMeses,
  type FechaLocal,
  type MesLocal,
} from "@/modules/agenda/tiempo";

type CalendarioProps = React.ComponentProps<typeof CalendarioMes>;

// Piezas visuales de la reserva pública. Sin datos de otras personas: solo horas libres y la propia reserva.

export function Encabezado({ paso, titulo, children }: { paso?: string; titulo: string; children?: React.ReactNode }) {
  return (
    <header className="max-w-2xl">
      <p className="font-sans text-xs uppercase tracking-[0.3em] text-gris-600">
        Agendar valoración{paso ? ` · ${paso}` : ""}
      </p>
      <h1 className="mt-5 font-sans text-[clamp(2rem,5vw,3.25rem)] font-light leading-[1.05] tracking-[-0.02em]">
        {titulo}
      </h1>
      {children && <div className="mt-5 max-w-xl font-serif text-lg leading-relaxed text-gris-600">{children}</div>}
    </header>
  );
}

export function Contenedor({ children }: { children: React.ReactNode }) {
  return <section className="mx-auto max-w-[84rem] px-5 pb-28 pt-8 md:px-10 lg:pt-14">{children}</section>;
}

export function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <p role="status" className="mt-8 max-w-xl border-l-2 border-azul bg-papel px-4 py-3 font-sans text-[0.9375rem] text-gris-800">
      {children}
    </p>
  );
}

export function ResumenCita({
  servicio,
  inicio,
  cambiar,
}: {
  servicio: { nombre: string; duracionMin: number; precioCop?: number | null };
  inicio: Date;
  cambiar?: string;
}) {
  return (
    <dl className="mt-10 grid max-w-xl grid-cols-2 gap-x-6 gap-y-5 border-y border-gris-200 py-6 font-sans">
      <div className="col-span-2">
        <dt className="text-xs uppercase tracking-[0.2em] text-gris-600">Cuándo</dt>
        <dd className="mt-1 text-xl first-letter:uppercase">
          {formatearFechaLarga(inicio)} · {formatearHora(inicio)}
        </dd>
      </div>
      <div>
        <dt className="text-xs uppercase tracking-[0.2em] text-gris-600">Servicio</dt>
        <dd className="mt-1">{servicio.nombre}</dd>
      </div>
      <div>
        <dt className="text-xs uppercase tracking-[0.2em] text-gris-600">Duración</dt>
        <dd className="mt-1 tabular-nums">
          {formatearDuracion(servicio.duracionMin)}
          {servicio.precioCop != null && <span className="text-gris-600"> · {formatearPrecio(servicio.precioCop)}</span>}
        </dd>
      </div>
      {cambiar && (
        <div className="col-span-2">
          <Link href={cambiar} className="text-sm text-gris-600 underline underline-offset-4 hover:text-gris-800">
            Cambiar día u hora
          </Link>
        </div>
      )}
    </dl>
  );
}

/** Agrupa cupos por día (en Bogotá). */
export function agruparPorDia(cupos: Date[]): Map<FechaLocal, Date[]> {
  const mapa = new Map<FechaLocal, Date[]>();
  for (const c of cupos) {
    const f = fechaLocal(c);
    mapa.set(f, [...(mapa.get(f) ?? []), c]);
  }
  return mapa;
}

export function etiquetaHora(cupo: Date) {
  return horaLocal(cupo);
}

export function NoDisponible({ whatsapp }: { whatsapp: string | null }) {
  return (
    <Contenedor>
      <Encabezado titulo="La reserva en línea no está disponible por ahora.">
        Escríbenos por WhatsApp y te ayudamos a encontrar un horario.
      </Encabezado>
      <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-5">
        <EnlaceWhatsapp enlace={whatsapp} className="text-gris-800" />
        <Link href="/" className="font-sans text-[0.9375rem] text-gris-600 underline-offset-[6px] hover:underline">
          Volver al inicio
        </Link>
      </div>
    </Contenedor>
  );
}

const ETIQUETA_DIA = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", weekday: "long", day: "numeric", month: "long" });

/** Datos de la cuadrícula de mes: solo qué días tienen cupos, nunca por qué los demás no. */
export function armarCalendario(o: {
  mes: MesLocal;
  conCupos: Set<FechaLocal>;
  seleccionado: FechaLocal | null;
  hoy: FechaLocal;
  primerMes: MesLocal;
  ultimoMes: MesLocal;
  hrefDia: (fecha: FechaLocal) => string;
  hrefMes: (mes: MesLocal) => string;
}): CalendarioProps {
  return {
    titulo: nombreMes(o.mes),
    hoy: o.hoy,
    seleccionado: o.seleccionado,
    anterior: o.mes > o.primerMes ? o.hrefMes(sumarMeses(o.mes, -1)) : null,
    siguiente: o.mes < o.ultimoMes ? o.hrefMes(sumarMeses(o.mes, 1)) : null,
    semanas: semanasDelMes(o.mes).map((semana) =>
      semana.map((fecha) => {
        const delMes = mesDe(fecha) === o.mes;
        const disponible = delMes && o.conCupos.has(fecha);
        return {
          fecha,
          numero: Number(fecha.slice(8)),
          delMes,
          href: disponible ? o.hrefDia(fecha) : null,
          etiqueta: `${ETIQUETA_DIA.format(aInstante(fecha, 12 * 60))}, ${disponible ? "con horarios disponibles" : "sin horarios"}`,
        };
      }),
    ),
  };
}
