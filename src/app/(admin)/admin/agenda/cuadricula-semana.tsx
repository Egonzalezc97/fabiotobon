import Link from "next/link";
import type { CitaAgenda } from "@/modules/agenda/consultas";
import { seCruzan, type HorarioSemanal } from "@/modules/agenda/disponibilidad";
import { fechaLocal, instante, minutosDelDia, type FechaLocal } from "@/modules/agenda/tiempo";
import { tramosDelDia, type BloqueoAgenda } from "@/modules/agenda/vista";
import { EnlaceCita, estiloCita, MarcasCita, rangoHoras, textoEstado } from "./bloque-cita";

// Cuadrícula de semana propia (sin librería): horas en el eje vertical, una columna por día y cada cita
// como bloque con altura según su duración. Como la base impide citas activas superpuestas, no hace falta
// repartir columnas por solapes.

const PX_POR_MIN = 1.1;
const DIA = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", weekday: "short", day: "numeric" });

type Props = {
  dias: FechaLocal[];
  hoy: FechaLocal;
  horario: HorarioSemanal;
  citas: CitaAgenda[];
  bloqueos: BloqueoAgenda[];
  desde: number;
  hasta: number;
  granularidadMin: number;
};

export function CuadriculaSemana({ dias, hoy, horario, citas, bloqueos, desde, hasta, granularidadMin }: Props) {
  const alto = (hasta - desde) * PX_POR_MIN;
  const horas = Array.from({ length: (hasta - desde) / 60 + 1 }, (_, i) => desde + i * 60);
  const posicion = (fecha: FechaLocal, inicio: Date, fin: Date) => {
    const inicioDia = instante(fecha);
    const a = Math.max(desde, inicio <= inicioDia ? 0 : minutosDelDia(inicio));
    const finMin = fin >= instante(fecha, 24 * 60) ? 24 * 60 : minutosDelDia(fin);
    const b = Math.min(hasta, finMin);
    return { top: (a - desde) * PX_POR_MIN, height: Math.max(0, b - a) * PX_POR_MIN };
  };

  return (
    <div className="overflow-x-auto border border-gris-200 bg-white">
      <div className="grid min-w-[56rem]" style={{ gridTemplateColumns: `3.5rem repeat(${dias.length}, minmax(0, 1fr))` }}>
        <div className="sticky top-0 z-20 border-b border-gris-200 bg-white" />
        {dias.map((d) => (
          <Link
            key={d}
            href={`/admin/agenda?fecha=${d}&vista=dia`}
            className={`sticky top-0 z-20 border-b border-l border-gris-200 bg-white px-2 py-2 text-center font-sans text-sm capitalize hover:text-azul ${
              d === hoy ? "font-medium text-azul" : "text-gris-800"
            }`}
          >
            {DIA.format(instante(d, 720)).replace(".", "")}
          </Link>
        ))}

        <div className="relative" style={{ height: alto }}>
          {horas.slice(0, -1).map((m) => (
            <span key={m} className="absolute right-2 -translate-y-1/2 font-sans text-[0.6875rem] tabular-nums text-gris-600" style={{ top: (m - desde) * PX_POR_MIN }}>
              {m === desde ? "" : `${m / 60}:00`}
            </span>
          ))}
        </div>

        {dias.map((d) => {
          const citasDia = citas.filter((c) => fechaLocal(c.inicio) === d);
          const bloqueosDia = bloqueos.filter((b) => b.inicio < instante(d, 24 * 60) && b.fin > instante(d));
          const tramos = tramosDelDia(d, horario);
          const ocupados = [...citasDia.filter((c) => c.estado === "pendiente" || c.estado === "confirmada"), ...bloqueosDia];
          // Celdas libres tocables dentro del horario, cada `granularidadMin`.
          const celdas = tramos.flatMap((t) => {
            const lista: { inicio: Date; fin: Date }[] = [];
            for (let i = t.inicio.getTime(); i + granularidadMin * 60_000 <= t.fin.getTime(); i += granularidadMin * 60_000) {
              const celda = { inicio: new Date(i), fin: new Date(i + granularidadMin * 60_000) };
              if (!ocupados.some((o) => seCruzan(celda, o))) lista.push(celda);
            }
            return lista;
          });

          return (
            <div key={d} className="relative border-l border-gris-200 bg-gris-100" style={{ height: alto }}>
              {horas.slice(1, -1).map((m) => (
                <div key={m} className="absolute inset-x-0 z-[1] border-t border-gris-200/80" style={{ top: (m - desde) * PX_POR_MIN }} />
              ))}
              {tramos.map((t) => (
                <div key={t.inicio.toISOString()} className="absolute inset-x-0 bg-white" style={posicion(d, t.inicio, t.fin)} />
              ))}
              {celdas.map((c) => (
                <Link
                  key={c.inicio.toISOString()}
                  href={`/admin/agenda/nueva?inicio=${encodeURIComponent(c.inicio.toISOString())}`}
                  aria-label={`Agendar a las ${rangoHoras(c.inicio, c.fin).split("–")[0]}`}
                  className="absolute inset-x-0 z-[2] hover:bg-azul/10 focus-visible:bg-azul/10"
                  style={posicion(d, c.inicio, c.fin)}
                />
              ))}
              {bloqueosDia.map((b) => (
                <div
                  key={b.id}
                  className="patron-bloqueo absolute inset-x-0 z-[3] overflow-hidden px-1.5 py-1 font-sans text-[0.6875rem] text-gris-800"
                  style={posicion(d, b.inicio, b.fin)}
                  title={b.motivo}
                >
                  Bloqueado{b.motivo ? ` · ${b.motivo}` : ""}
                </div>
              ))}
              {citasDia.map((c) => {
                const p = posicion(d, c.inicio, c.fin);
                return (
                  <EnlaceCita
                    key={c.id}
                    cita={c}
                    style={p}
                    className={`absolute inset-x-1 z-[4] overflow-hidden px-1.5 py-1 font-sans text-xs leading-tight shadow-[0_0_0_1px_rgba(0,0,0,0.04)] hover:z-[5] hover:ring-1 hover:ring-gris-800 ${estiloCita(c.estado)}`}
                  >
                    <span className="block">
                      <span className="flex items-center gap-1">
                        <span className="tabular-nums text-gris-600">{rangoHoras(c.inicio, c.fin)}</span>
                        <MarcasCita cita={c} />
                      </span>
                      <span className={`block truncate font-medium ${c.estado === "no_asistio" ? "line-through" : ""}`}>{c.pacienteNombre}</span>
                      {p.height > 40 && <span className="block truncate text-gris-600">{c.servicioNombre}</span>}
                      {p.height > 56 && <span className="block truncate text-gris-600">{textoEstado(c.estado)}</span>}
                    </span>
                  </EnlaceCita>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
