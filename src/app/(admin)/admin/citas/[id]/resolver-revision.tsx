"use client";

import { useAccionFormulario } from "@/components/usar-accion-formulario";
import { Alerta, Boton } from "@/components/panel/ui";
import { resolverRevisionAccion, type EstadoAccion } from "../acciones";

export function ResolverRevision({ citaId }: { citaId: string }) {
  const { estado, alEnviar, pendiente } = useAccionFormulario<EstadoAccion>(resolverRevisionAccion, {});
  return (
    <form onSubmit={alEnviar} className="grid gap-3">
      <input type="hidden" name="citaId" value={citaId} />
      {estado.error && <Alerta tono="error">{estado.error}</Alerta>}
      {estado.ok && <Alerta tono="ok">{estado.ok}</Alerta>}
      {!estado.ok && (
        <div>
          <Boton variante="secundario" pendiente={pendiente}>
            Confirmé que es el titular: vincular a la ficha
          </Boton>
        </div>
      )}
    </form>
  );
}
