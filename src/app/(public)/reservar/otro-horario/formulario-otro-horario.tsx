"use client";

import { useAccionFormulario } from "@/components/usar-accion-formulario";
import { elegirOtroHorario, type EstadoFormulario } from "../acciones";
import { Mensaje } from "../_campos";

const hora = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

export function FormularioOtroHorario({ cupos }: { cupos: string[] }) {
  const { estado, alEnviar, pendiente } = useAccionFormulario<EstadoFormulario>(elegirOtroHorario, {});
  if (cupos.length === 0) {
    return <p className="mt-8 font-serif text-lg text-gris-600">No hay horarios libres ese día. Elige otro día.</p>;
  }
  return (
    <form onSubmit={alEnviar} className="mt-4 max-w-3xl">
      <Mensaje texto={estado.mensaje} />
      <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
        {cupos.map((c) => (
          <li key={c}>
            <button
              type="submit"
              name="inicio"
              value={c}
              disabled={pendiente}
              className="block w-full rounded-[2px] border border-gris-200 py-3 text-center font-sans tabular-nums text-gris-800 transition-colors duration-150 hover:border-azul hover:text-azul disabled:opacity-60"
            >
              {hora.format(new Date(c))}
            </button>
          </li>
        ))}
      </ul>
    </form>
  );
}
