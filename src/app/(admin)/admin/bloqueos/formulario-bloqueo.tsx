"use client";

import { useState } from "react";
import { useAccionFormulario } from "@/components/usar-accion-formulario";
import { Alerta, Boton, CampoPanel, Casilla } from "@/components/panel/ui";
import { crearBloqueoAccion, type EstadoBloqueo } from "./acciones";

const FECHA = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const ISO_FECHA = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" });
const ISO_HORA = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Bogota", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

export function FormularioBloqueo({ hoy, pasoMinutos }: { hoy: string; pasoMinutos: number }) {
  const { estado, alEnviar, pendiente } = useAccionFormulario<EstadoBloqueo>(crearBloqueoAccion, {});
  const [tipo, setTipo] = useState<"horas" | "dias">("horas");
  const [acciones, setAcciones] = useState<Record<string, "cancelar" | "reprogramar">>({});
  const afectadas = estado.ok ? [] : (estado.afectadas ?? []);

  return (
    <form onSubmit={alEnviar} className="grid gap-4 border border-gris-200 bg-white p-4">
      <h2 className="font-sans text-sm uppercase tracking-[0.14em] text-gris-600">Nuevo bloqueo</h2>
      <div className="flex gap-2 font-sans text-sm">
        {(["horas", "dias"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTipo(t)}
            aria-pressed={tipo === t}
            className={`min-h-11 rounded-[2px] border px-3 ${tipo === t ? "border-gris-800 bg-gris-800 text-white" : "border-gris-200"}`}
          >
            {t === "horas" ? "Unas horas" : "Días completos"}
          </button>
        ))}
      </div>
      <input type="hidden" name="tipo" value={tipo} />
      {tipo === "horas" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="col-span-2 sm:col-span-1">
            <CampoPanel etiqueta="Fecha" id="fecha" name="fecha" type="date" defaultValue={hoy} required />
          </div>
          <CampoPanel etiqueta="Desde" id="desde" name="desde" type="time" step={pasoMinutos * 60} required />
          <CampoPanel etiqueta="Hasta" id="hasta" name="hasta" type="time" step={pasoMinutos * 60} required />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <CampoPanel etiqueta="Desde el día" id="desdeFecha" name="desdeFecha" type="date" defaultValue={hoy} required />
          <CampoPanel etiqueta="Hasta el día (inclusive)" id="hastaFecha" name="hastaFecha" type="date" defaultValue={hoy} />
        </div>
      )}
      <CampoPanel etiqueta="Motivo (privado: el público solo ve “no disponible”)" id="motivo" name="motivo" maxLength={300} placeholder="Almuerzo, reunión, vacaciones…" />

      {afectadas.length > 0 && (
        <fieldset className="grid gap-3 border border-red-700 p-3">
          <legend className="px-1 font-sans text-sm font-medium text-red-700">Citas afectadas · {afectadas.length}</legend>
          {afectadas.map((c) => (
            <div key={c.id} className="grid gap-2 border-b border-gris-200 pb-3 font-sans last:border-0 last:pb-0">
              <input type="hidden" name="afectada" value={c.id} />
              <p>
                <span className="font-medium">{c.pacienteNombre}</span> · {c.servicioNombre}
                <span className="block text-sm text-gris-600">{FECHA.format(new Date(c.inicio))}</span>
              </p>
              <div className="flex flex-wrap gap-4 text-sm">
                {(["reprogramar", "cancelar"] as const).map((a) => (
                  <label key={a} className="flex min-h-11 items-center gap-2">
                    <input
                      type="radio"
                      name={`accion_${c.id}`}
                      value={a}
                      required
                      className="size-5 accent-azul"
                      onChange={() => setAcciones((x) => ({ ...x, [c.id]: a }))}
                    />
                    {a === "reprogramar" ? "Reprogramar" : "Cancelar"}
                  </label>
                ))}
              </div>
              {acciones[c.id] === "reprogramar" && (
                <div className="grid grid-cols-2 gap-3">
                  <CampoPanel etiqueta="Nueva fecha" id={`fecha_${c.id}`} name={`fecha_${c.id}`} type="date" defaultValue={ISO_FECHA.format(new Date(c.inicio))} required />
                  <CampoPanel etiqueta="Nueva hora" id={`hora_${c.id}`} name={`hora_${c.id}`} type="time" step={pasoMinutos * 60} defaultValue={ISO_HORA.format(new Date(c.inicio))} required />
                  <div className="col-span-2">
                    <Casilla name={`fuera_${c.id}`} value="si" etiqueta="Permitir fuera del horario laboral" />
                  </div>
                </div>
              )}
            </div>
          ))}
        </fieldset>
      )}

      {estado.error && <Alerta tono="error">{estado.error}</Alerta>}
      {estado.ok && (
        <Alerta tono="ok">
          {estado.ok}
          {estado.avisar && estado.avisar.length > 0 && (
            <span className="mt-2 block">
              Aún no se envían mensajes. Avísales a:{" "}
              {estado.avisar.map((a, i) => (
                <span key={i}>
                  {i > 0 && ", "}
                  {a.celular ? (
                    <a href={`https://wa.me/${a.celular.slice(1)}`} target="_blank" rel="noopener noreferrer" className="underline">
                      {a.nombre}
                    </a>
                  ) : (
                    a.nombre
                  )}{" "}
                  (cita {a.accion})
                </span>
              ))}
            </span>
          )}
        </Alerta>
      )}
      <div>
        <Boton pendiente={pendiente}>{afectadas.length > 0 ? "Confirmar bloqueo y decisiones" : "Guardar bloqueo"}</Boton>
      </div>
    </form>
  );
}
