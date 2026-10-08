import Link from "next/link";
import type { CitaAgenda } from "@/modules/agenda/consultas";
import type { HorarioSemanal } from "@/modules/agenda/disponibilidad";
import type { FechaLocal } from "@/modules/agenda/tiempo";
import { elementosDelDia, type BloqueoAgenda } from "@/modules/agenda/vista";
import { EnlaceCita, estiloCita, MarcasCita, rangoHoras, textoEstado } from "./bloque-cita";

/** Vista de día como lista cronológica: citas, bloqueos y huecos libres tocables. Pensada para el celular. */
export function ListaDia({
  fecha,
  horario,
  citas,
  bloqueos,
}: {
  fecha: FechaLocal;
  horario: HorarioSemanal;
  citas: CitaAgenda[];
  bloqueos: BloqueoAgenda[];
}) {
  const elementos = elementosDelDia(fecha, horario, citas, bloqueos);
  if (elementos.length === 0) {
    return (
      <div className="border border-gris-200 bg-white p-6 font-sans text-sm text-gris-600">
        Sin horario ni citas este día.{" "}
        <Link href={`/admin/agenda/nueva?fecha=${fecha}`} className="text-azul underline underline-offset-4">
          Crear una cita
        </Link>
      </div>
    );
  }
  return (
    <ol className="grid gap-2">
      {elementos.map((e) => {
        const horas = rangoHoras(e.inicio, e.fin);
        if (e.tipo === "cita") {
          return (
            <li key={`c-${e.cita.id}`}>
              <EnlaceCita cita={e.cita} className={`flex min-h-14 gap-4 px-4 py-3 font-sans ${estiloCita(e.cita.estado)}`}>
                <span className="w-24 shrink-0 text-sm tabular-nums">{horas}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className={`font-medium ${e.cita.estado === "no_asistio" ? "line-through" : ""}`}>{e.cita.pacienteNombre}</span>
                    <MarcasCita cita={e.cita} />
                  </span>
                  <span className="block text-sm text-gris-600">
                    {e.cita.servicioNombre} · {textoEstado(e.cita.estado)}
                  </span>
                </span>
              </EnlaceCita>
            </li>
          );
        }
        if (e.tipo === "bloqueo") {
          return (
            <li key={`b-${e.bloqueo.id}`} className="patron-bloqueo flex min-h-12 gap-4 px-4 py-3 font-sans text-sm text-gris-800">
              <span className="w-24 shrink-0 tabular-nums">{e.bloqueo.dia_completo ? "Todo el día" : horas}</span>
              <span>Bloqueado{e.bloqueo.motivo ? ` · ${e.bloqueo.motivo}` : ""}</span>
            </li>
          );
        }
        return (
          <li key={`l-${e.inicio.toISOString()}`}>
            <Link
              href={`/admin/agenda/nueva?inicio=${encodeURIComponent(e.inicio.toISOString())}`}
              className="flex min-h-11 items-center gap-4 border border-dashed border-gris-200 px-4 font-sans text-sm text-gris-600 hover:border-azul hover:text-azul"
            >
              <span className="w-24 shrink-0 tabular-nums">{horas}</span>
              <span>Libre · Agendar</span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
