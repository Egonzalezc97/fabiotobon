"use client";

import { useAccionFormulario } from "@/components/usar-accion-formulario";
import { Alerta, Boton, CampoPanel, Casilla } from "@/components/panel/ui";
import { NOMBRES_ESTADO, type EstadoCita } from "@/modules/agenda/estados";
import { cambiarEstadoAccion, cancelarAccion, reprogramarAccion, type EstadoAccion } from "../acciones";

type Props = {
  citaId: string;
  estado: EstadoCita;
  transiciones: EstadoCita[];
  fecha: string;
  hora: string;
  pasoMinutos: number;
};

function Resultado({ estado }: { estado: EstadoAccion }) {
  if (estado.error) return <Alerta tono="error">{estado.error}</Alerta>;
  if (estado.ok) return <Alerta tono="ok">{estado.ok}</Alerta>;
  return null;
}

export function AccionesCita({ citaId, estado, transiciones, fecha, hora, pasoMinutos }: Props) {
  const cambio = useAccionFormulario<EstadoAccion>(cambiarEstadoAccion, {});
  const mover = useAccionFormulario<EstadoAccion>(reprogramarAccion, {});
  const cancelar = useAccionFormulario<EstadoAccion>(cancelarAccion, {});
  const activa = estado === "pendiente" || estado === "confirmada";

  return (
    <div className="grid gap-4">
      {transiciones.length > 0 && (
        <form onSubmit={cambio.alEnviar} className="grid gap-3 border border-gris-200 bg-white p-4">
          <input type="hidden" name="citaId" value={citaId} />
          <h2 className="font-sans text-sm uppercase tracking-[0.14em] text-gris-600">Cambiar estado</h2>
          <div className="flex flex-wrap gap-2">
            {transiciones.map((t) => (
              <Boton key={t} name="estado" value={t} variante="secundario" pendiente={cambio.pendiente}>
                {NOMBRES_ESTADO[t]}
              </Boton>
            ))}
          </div>
          <Resultado estado={cambio.estado} />
        </form>
      )}

      {activa && (
        <form onSubmit={mover.alEnviar} className="grid gap-3 border border-gris-200 bg-white p-4">
          <input type="hidden" name="citaId" value={citaId} />
          <h2 className="font-sans text-sm uppercase tracking-[0.14em] text-gris-600">Reprogramar</h2>
          <div className="grid grid-cols-2 gap-3">
            <CampoPanel etiqueta="Fecha" id="fecha-mover" name="fecha" type="date" defaultValue={fecha} required />
            <CampoPanel etiqueta="Hora" id="hora-mover" name="hora" type="time" step={pasoMinutos * 60} defaultValue={hora} required />
          </div>
          {mover.estado.fueraDeHorario && <Casilla name="fueraDeHorario" value="si" etiqueta="Sí, mover fuera del horario laboral" />}
          <Resultado estado={mover.estado} />
          <div>
            <Boton pendiente={mover.pendiente}>Mover cita</Boton>
          </div>
          <p className="font-sans text-xs text-gris-600">Aún no se envían mensajes: avísale al paciente del cambio.</p>
        </form>
      )}

      {activa && (
        <details className="border border-gris-200 bg-white p-4">
          <summary className="min-h-11 cursor-pointer content-center font-sans text-sm text-red-700">Cancelar cita</summary>
          <form onSubmit={cancelar.alEnviar} className="mt-3 grid gap-3">
            <input type="hidden" name="citaId" value={citaId} />
            <CampoPanel etiqueta="Motivo (opcional, interno)" id="motivo" name="motivo" maxLength={300} />
            <Resultado estado={cancelar.estado} />
            <div>
              <Boton variante="peligro" pendiente={cancelar.pendiente}>
                Sí, cancelar la cita
              </Boton>
            </div>
          </form>
        </details>
      )}
    </div>
  );
}
