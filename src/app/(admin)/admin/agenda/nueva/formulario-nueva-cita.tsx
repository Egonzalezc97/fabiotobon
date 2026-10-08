"use client";

import { useState, useTransition } from "react";
import { useAccionFormulario } from "@/components/usar-accion-formulario";
import { Alerta, Boton, CampoPanel, Casilla, SelectorPanel } from "@/components/panel/ui";
import { buscarPacientesAccion, crearCitaAccion, type EstadoAccion } from "../../citas/acciones";

type Props = {
  servicios: { id: string; nombre: string; duracionMin: number }[];
  tiposDocumento: { valor: string; nombre: string }[];
  fecha: string;
  hora: string;
  pasoMinutos: number;
  paciente: { id: string; nombre: string } | null;
};

type Resultado = Awaited<ReturnType<typeof buscarPacientesAccion>>[number];

export function FormularioNuevaCita({ servicios, tiposDocumento, fecha, hora, pasoMinutos, paciente }: Props) {
  const { estado, alEnviar, pendiente } = useAccionFormulario<EstadoAccion>(crearCitaAccion, {});
  const [modo, setModo] = useState<"existente" | "nuevo">("existente");
  const [elegido, setElegido] = useState<{ id: string; nombre: string } | null>(paciente);
  const [termino, setTermino] = useState("");
  const [resultados, setResultados] = useState<Resultado[] | null>(null);
  const [buscando, iniciarBusqueda] = useTransition();

  function buscar() {
    iniciarBusqueda(async () => setResultados(await buscarPacientesAccion(termino)));
  }

  return (
    <form onSubmit={alEnviar} className="grid gap-6">
      <fieldset className="grid gap-3 border border-gris-200 bg-white p-4">
        <legend className="px-1 font-sans text-sm font-medium">Paciente</legend>
        <div className="flex gap-2 font-sans text-sm">
          {(["existente", "nuevo"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setModo(m)}
              aria-pressed={modo === m}
              className={`min-h-11 rounded-[2px] border px-3 ${modo === m ? "border-gris-800 bg-gris-800 text-white" : "border-gris-200"}`}
            >
              {m === "existente" ? "Buscar paciente" : "Paciente nuevo"}
            </button>
          ))}
        </div>
        <input type="hidden" name="modoPaciente" value={modo} />

        {modo === "existente" ? (
          <>
            <input type="hidden" name="pacienteId" value={elegido?.id ?? ""} />
            {elegido ? (
              <div className="flex items-center justify-between gap-3 border border-gris-200 px-3 py-2 font-sans">
                <span>{elegido.nombre}</span>
                <button type="button" className="text-sm text-gris-600 underline" onClick={() => setElegido(null)}>
                  Cambiar
                </button>
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <input
                    aria-label="Buscar por nombre, documento o celular"
                    placeholder="Nombre, documento o celular"
                    value={termino}
                    onChange={(e) => setTermino(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        buscar();
                      }
                    }}
                    className="min-h-11 flex-1 rounded-[2px] border border-gris-200 px-3 font-sans outline-none focus:border-azul"
                  />
                  <Boton type="button" variante="secundario" onClick={buscar} pendiente={buscando}>
                    Buscar
                  </Boton>
                </div>
                {resultados && (
                  <ul className="divide-y divide-gris-200 border border-gris-200 font-sans text-sm">
                    {resultados.length === 0 && <li className="px-3 py-3 text-gris-600">Sin resultados. Puedes crearlo como paciente nuevo.</li>}
                    {resultados.map((r) => (
                      <li key={r.id}>
                        <button
                          type="button"
                          onClick={() => setElegido({ id: r.id, nombre: r.nombre })}
                          className="flex min-h-11 w-full items-center justify-between gap-3 px-3 text-left hover:bg-papel"
                        >
                          <span>{r.nombre}</span>
                          <span className="text-gris-600 tabular-nums">
                            {r.tipo_documento} {r.numero_documento}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectorPanel etiqueta="Tipo de documento" id="tipoDocumento" name="tipoDocumento" defaultValue="CC">
              {tiposDocumento.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.nombre}
                </option>
              ))}
            </SelectorPanel>
            <CampoPanel etiqueta="Número de documento" id="numeroDocumento" name="numeroDocumento" required autoComplete="off" />
            <div className="sm:col-span-2">
              <CampoPanel etiqueta="Nombre completo" id="nombre" name="nombre" required />
            </div>
            <CampoPanel etiqueta="Celular (opcional)" id="celular" name="celular" type="tel" inputMode="tel" placeholder="300 123 4567" />
            <CampoPanel etiqueta="Correo (opcional)" id="correo" name="correo" type="email" />
          </div>
        )}
      </fieldset>

      <SelectorPanel etiqueta="Servicio" id="servicioId" name="servicioId" required defaultValue="">
        <option value="" disabled>
          Elige un servicio
        </option>
        {servicios.map((s) => (
          <option key={s.id} value={s.id}>
            {s.nombre} · {s.duracionMin} min
          </option>
        ))}
      </SelectorPanel>

      <div className="grid grid-cols-2 gap-3">
        <CampoPanel etiqueta="Fecha" id="fecha" name="fecha" type="date" defaultValue={fecha} required />
        <CampoPanel etiqueta="Hora" id="hora" name="hora" type="time" step={pasoMinutos * 60} defaultValue={hora} required />
      </div>

      <SelectorPanel etiqueta="Estado" id="estado" name="estado" defaultValue="confirmada">
        <option value="confirmada">Confirmada</option>
        <option value="pendiente">Pendiente</option>
      </SelectorPanel>

      <div>
        <label htmlFor="notas" className="block font-sans text-sm">
          Notas internas (opcional, no son historia clínica)
        </label>
        <textarea id="notas" name="notas" rows={3} maxLength={2000} className="mt-1 w-full rounded-[2px] border border-gris-200 p-3 font-sans outline-none focus:border-azul" />
      </div>

      {estado.error && <Alerta tono="error">{estado.error}</Alerta>}
      {estado.fueraDeHorario && <Casilla name="fueraDeHorario" value="si" etiqueta="Sí, agendar fuera del horario laboral" />}

      <div>
        <Boton pendiente={pendiente}>{pendiente ? "Guardando…" : "Crear cita"}</Boton>
      </div>
    </form>
  );
}
