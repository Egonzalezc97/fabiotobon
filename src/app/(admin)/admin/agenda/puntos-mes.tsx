import Link from "next/link";
import { mesDe, type FechaLocal, type MesLocal } from "@/modules/agenda/tiempo";
import type { ResumenDia } from "@/modules/agenda/vista";

// Vista de mes para celular: un punto por cita (máximo tres) y, al tocar el día, su lista debajo.

const DIAS = ["L", "M", "M", "J", "V", "S", "D"];

function colorPunto(estado: string) {
  if (estado === "confirmada") return "bg-azul";
  if (estado === "pendiente") return "border border-gris-600 bg-white";
  return "bg-gris-400";
}

export function PuntosMes({
  mes,
  semanas,
  hoy,
  seleccionado,
  resumen,
}: {
  mes: MesLocal;
  semanas: FechaLocal[][];
  hoy: FechaLocal;
  seleccionado: FechaLocal;
  resumen: Map<FechaLocal, ResumenDia>;
}) {
  return (
    <div className="border border-gris-200 bg-white p-2 font-sans">
      <div className="grid grid-cols-7 pb-1">
        {DIAS.map((d, i) => (
          <span key={i} className="text-center text-xs uppercase tracking-[0.14em] text-gris-600">
            {d}
          </span>
        ))}
      </div>
      {semanas.map((semana) => (
        <div key={semana[0]} className="grid grid-cols-7 gap-0.5">
          {semana.map((dia) => {
            const r = resumen.get(dia);
            const delMes = mesDe(dia) === mes;
            const elegido = dia === seleccionado;
            const citas = r?.citas ?? [];
            return (
              <Link
                key={dia}
                href={`/admin/agenda?vista=mes&fecha=${dia}`}
                scroll={false}
                aria-current={elegido ? "date" : undefined}
                aria-label={`${dia}: ${citas.length} ${citas.length === 1 ? "cita" : "citas"}${r?.bloqueoDiaCompleto ? ", bloqueado" : ""}`}
                className={`flex h-14 flex-col items-center justify-center gap-1 text-sm tabular-nums ${
                  elegido
                    ? "bg-gris-800 text-white"
                    : r?.bloqueoDiaCompleto
                      ? "patron-bloqueo text-gris-800"
                      : delMes
                        ? "text-gris-800"
                        : "text-gris-400"
                } ${dia === hoy && !elegido ? "font-semibold text-azul" : ""}`}
              >
                {Number(dia.slice(8))}
                <span className="flex h-1.5 gap-0.5" aria-hidden="true">
                  {citas.slice(0, 3).map((c) => (
                    <span key={c.id} className={`size-1.5 rounded-full ${elegido && c.estado === "confirmada" ? "bg-white" : colorPunto(c.estado)}`} />
                  ))}
                </span>
              </Link>
            );
          })}
        </div>
      ))}
    </div>
  );
}
