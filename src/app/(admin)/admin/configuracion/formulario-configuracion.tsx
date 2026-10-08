"use client";

import { useAccionFormulario } from "@/components/usar-accion-formulario";
import { Alerta, Boton, CampoPanel, Casilla, SelectorPanel } from "@/components/panel/ui";
import type { ParametrosConfigurables } from "@/modules/configuracion";
import { guardarConfiguracionAccion, type EstadoConfiguracion } from "./acciones";

export function FormularioConfiguracion({ parametros }: { parametros: ParametrosConfigurables }) {
  const { estado, alEnviar, pendiente } = useAccionFormulario<EstadoConfiguracion>(guardarConfiguracionAccion, {});
  return (
    <form onSubmit={alEnviar} className="grid gap-5 border border-gris-200 bg-white p-4">
      <p className="font-sans text-xs text-gris-600">
        Todos estos valores son DECISIONES PENDIENTES DE FABIO: están en los valores por defecto acordados hasta que él los confirme.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectorPanel etiqueta="Cupos cada" id="granularidadMin" name="granularidadMin" defaultValue={String(parametros.granularidadMin)}>
          {[10, 15, 20, 30, 60].map((m) => (
            <option key={m} value={m}>
              {m} minutos
            </option>
          ))}
        </SelectorPanel>
        <CampoPanel
          etiqueta="Antelación mínima (horas)"
          id="antelacionHoras"
          name="antelacionHoras"
          type="number"
          min={0}
          max={336}
          defaultValue={Math.round(parametros.antelacionMin / 60)}
          ayuda="Cuánto antes, como mínimo, se puede reservar por la web."
        />
        <CampoPanel
          etiqueta="Horizonte de reserva (días)"
          id="horizonteDias"
          name="horizonteDias"
          type="number"
          min={0}
          max={365}
          defaultValue={parametros.horizonteDias}
          ayuda="Hasta cuántos días hacia adelante se puede reservar."
        />
        <CampoPanel
          etiqueta="Valoraciones futuras por documento"
          id="maxValoracionesFuturas"
          name="maxValoracionesFuturas"
          type="number"
          min={1}
          max={10}
          defaultValue={parametros.maxValoracionesFuturas}
        />
        <SelectorPanel etiqueta="Estado inicial de una cita web" id="estadoInicialCitaWeb" name="estadoInicialCitaWeb" defaultValue={parametros.estadoInicialCitaWeb}>
          <option value="confirmada">Confirmada de inmediato</option>
          <option value="pendiente">Pendiente hasta que Fabio la confirme</option>
        </SelectorPanel>
      </div>
      <Casilla name="documentoObligatorio" value="si" defaultChecked={parametros.documentoObligatorio} etiqueta="Pedir documento en la reserva web" />
      {estado.error && <Alerta tono="error">{estado.error}</Alerta>}
      {estado.ok && <Alerta tono="ok">{estado.ok}</Alerta>}
      <div>
        <Boton pendiente={pendiente}>Guardar</Boton>
      </div>
    </form>
  );
}
