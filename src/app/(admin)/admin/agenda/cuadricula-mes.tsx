import Link from "next/link";
import type { CitaAgenda } from "@/modules/agenda/consultas";
import { horaLocal, mesDe, type FechaLocal, type MesLocal } from "@/modules/agenda/tiempo";
import type { BloqueoAgenda, ResumenDia } from "@/modules/agenda/vista";
import { EnlaceCita, MarcasCita } from "./bloque-cita";

// Vista de mes tipo Google Calendar (escritorio): cada día con sus citas como etiquetas
// (hora, paciente, color por estado), bloqueos visibles y "+N más" cuando no caben.

const MAXIMO_ETIQUETAS = 3;
const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function estiloEtiqueta(estado: string): string {
  switch (estado) {
    case "confirmada":
      return "border-l-2 border-azul bg-white";
    case "pendiente":
      return "border border-dashed border-gris-600 bg-white";
    default:
      return "bg-gris-200 text-gris-600";
  }
}

type Elemento = { tipo: "cita"; inicio: Date; cita: CitaAgenda } | { tipo: "bloqueo"; inicio: Date; bloqueo: BloqueoAgenda };

export function CuadriculaMes({
  mes,
  semanas,
  hoy,
  resumen,
}: {
  mes: MesLocal;
  semanas: FechaLocal[][];
  hoy: FechaLocal;
  resumen: Map<FechaLocal, ResumenDia>;
}) {
  return (
    <div className="overflow-x-auto border border-gris-200 bg-white">
      <div className="min-w-[56rem]">
        <div className="grid grid-cols-7 border-b border-gris-200">
          {DIAS.map((d) => (
            <div key={d} className="px-2 py-2 text-center font-sans text-xs uppercase tracking-[0.14em] text-gris-600">
              {d}
            </div>
          ))}
        </div>
        {semanas.map((semana) => (
          <div key={semana[0]} className="grid grid-cols-7 border-b border-gris-200 last:border-b-0">
            {semana.map((dia) => {
              const r = resumen.get(dia);
              const delMes = mesDe(dia) === mes;
              const elementos: Elemento[] = [
                ...(r?.citas ?? []).map((c) => ({ tipo: "cita" as const, inicio: c.inicio, cita: c })),
                ...(r?.bloqueosParciales ?? []).map((b) => ({ tipo: "bloqueo" as const, inicio: b.inicio, bloqueo: b })),
              ].sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
              const visibles = elementos.slice(0, MAXIMO_ETIQUETAS);
              const ocultos = elementos.length - visibles.length;
              const verDia = `/admin/agenda?fecha=${dia}&vista=dia`;

              return (
                <div
                  key={dia}
                  className={`relative min-h-32 border-l border-gris-200 p-1.5 font-sans first:border-l-0 ${
                    r?.bloqueoDiaCompleto ? "patron-bloqueo" : delMes ? "bg-white" : "bg-papel"
                  }`}
                >
                  {/* Tocar el día (fuera de las etiquetas) abre su vista de día. */}
                  <Link href={verDia} aria-label={`Ver el ${dia}`} className="absolute inset-0 z-0 hover:bg-azul/5" />
                  <div className="relative z-10 flex items-center justify-between gap-1 pointer-events-none">
                    <span
                      className={`grid h-6 min-w-6 place-items-center px-1 text-sm tabular-nums ${
                        dia === hoy ? "bg-azul text-white" : delMes ? "text-gris-800" : "text-gris-400"
                      }`}
                    >
                      {Number(dia.slice(8))}
                    </span>
                    {r?.bloqueoDiaCompleto && (
                      <span className="truncate text-[0.6875rem] text-gris-800">Bloqueado{r.bloqueoDiaCompleto.motivo ? ` · ${r.bloqueoDiaCompleto.motivo}` : ""}</span>
                    )}
                  </div>
                  <ul className="relative z-10 mt-1 grid gap-0.5">
                    {visibles.map((e) =>
                      e.tipo === "cita" ? (
                        <li key={e.cita.id}>
                          <EnlaceCita
                            cita={e.cita}
                            className={`flex items-center gap-1 overflow-hidden px-1.5 py-0.5 text-xs leading-tight hover:ring-1 hover:ring-gris-800 ${estiloEtiqueta(e.cita.estado)}`}
                          >
                            <span className="shrink-0 tabular-nums text-gris-600">{horaLocal(e.cita.inicio)}</span>
                            <span className={`truncate ${e.cita.estado === "no_asistio" ? "line-through" : ""}`}>{e.cita.pacienteNombre}</span>
                            <MarcasCita cita={e.cita} />
                          </EnlaceCita>
                        </li>
                      ) : (
                        <li key={e.bloqueo.id} className="patron-bloqueo truncate px-1.5 py-0.5 text-xs text-gris-800" title={e.bloqueo.motivo}>
                          <span className="tabular-nums">{horaLocal(e.bloqueo.inicio)}</span> Bloqueo{e.bloqueo.motivo ? ` · ${e.bloqueo.motivo}` : ""}
                        </li>
                      ),
                    )}
                    {ocultos > 0 && (
                      <li>
                        <Link href={verDia} className="block px-1.5 text-xs font-medium text-azul hover:underline">
                          +{ocultos} más
                        </Link>
                      </li>
                    )}
                  </ul>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
