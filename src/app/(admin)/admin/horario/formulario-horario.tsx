"use client";

import Link from "next/link";
import { useAccionFormulario } from "@/components/usar-accion-formulario";
import { Alerta, Boton } from "@/components/panel/ui";
import { guardarHorarioAccion, type EstadoHorario } from "./acciones";

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const FECHA = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/** Hasta tres tramos por día (p. ej. mañana y tarde). */
export function FormularioHorario({ inicial, pasoMinutos }: { inicial: Record<number, { inicio: string; fin: string }[]>; pasoMinutos: number }) {
  const { estado, alEnviar, pendiente } = useAccionFormulario<EstadoHorario>(guardarHorarioAccion, {});
  return (
    <form onSubmit={alEnviar} className="grid gap-4">
      <div className="divide-y divide-gris-200 border border-gris-200 bg-white">
        {DIAS.map((nombre, i) => {
          const dia = i + 1;
          return (
            <fieldset key={dia} className="grid gap-2 p-4 sm:grid-cols-[8rem_1fr] sm:items-start">
              <legend className="float-left font-sans text-sm font-medium sm:pt-2.5">{nombre}</legend>
              <div className="grid gap-2">
                {[0, 1, 2].map((n) => {
                  const t = inicial[dia]?.[n];
                  return (
                    <div key={n} className="flex items-center gap-2 font-sans text-sm">
                      <input
                        type="time"
                        step={pasoMinutos * 60}
                        name={`tramo_${dia}_${n}_inicio`}
                        defaultValue={t?.inicio ?? ""}
                        aria-label={`${nombre}, tramo ${n + 1}, desde`}
                        className="min-h-11 rounded-[2px] border border-gris-200 px-2 outline-none focus:border-azul"
                      />
                      <span className="text-gris-600">a</span>
                      <input
                        type="time"
                        step={pasoMinutos * 60}
                        name={`tramo_${dia}_${n}_fin`}
                        defaultValue={t?.fin ?? ""}
                        aria-label={`${nombre}, tramo ${n + 1}, hasta`}
                        className="min-h-11 rounded-[2px] border border-gris-200 px-2 outline-none focus:border-azul"
                      />
                    </div>
                  );
                })}
              </div>
            </fieldset>
          );
        })}
      </div>
      <p className="font-sans text-xs text-gris-600">Deja vacíos los tramos que no uses. Un día sin tramos no se ofrece en la web.</p>
      {estado.error && <Alerta tono="error">{estado.error}</Alerta>}
      {estado.ok && (
        <Alerta tono="ok">
          {estado.ok}
          {estado.fueraDeHorario && estado.fueraDeHorario.length > 0 && (
            <span className="mt-2 block">
              Estas citas futuras quedaron fuera del horario nuevo (siguen vigentes; muévelas si hace falta):
              <span className="mt-1 block">
                {estado.fueraDeHorario.map((c, i) => (
                  <span key={c.id}>
                    {i > 0 && " · "}
                    <Link href={`/admin/citas/${c.id}`} prefetch={false} className="underline">
                      {c.pacienteNombre}, {FECHA.format(new Date(c.inicio))}
                    </Link>
                  </span>
                ))}
              </span>
            </span>
          )}
        </Alerta>
      )}
      <div>
        <Boton pendiente={pendiente}>Guardar horario</Boton>
      </div>
    </form>
  );
}
