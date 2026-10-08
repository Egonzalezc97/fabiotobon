"use client";

import { useAccionFormulario } from "@/components/usar-accion-formulario";
import { Alerta, Boton, Casilla } from "@/components/panel/ui";
import { fusionarAccion, type EstadoPaciente } from "../../acciones";

type Resumen = { id: string; nombre: string; documento: string; celular: string; citas: number; tratamientos: number };

function Tarjeta({ r, valor, defecto }: { r: Resumen; valor: string; defecto?: boolean }) {
  return (
    <label className="grid cursor-pointer gap-1 border border-gris-200 bg-white p-4 font-sans has-[:checked]:border-gris-800">
      <span className="flex items-center gap-2">
        <input type="radio" name="queda" value={valor} defaultChecked={defecto} className="size-5 accent-azul" />
        <span className="font-medium">Queda esta ficha</span>
      </span>
      <span>{r.nombre}</span>
      <span className="text-sm text-gris-600">
        {r.documento} · {r.celular}
      </span>
      <span className="text-sm text-gris-600">
        {r.citas} citas · {r.tratamientos} tratamientos
      </span>
    </label>
  );
}

export function FormularioFusion({ actual, otra }: { actual: Resumen; otra: Resumen }) {
  const { estado, alEnviar, pendiente } = useAccionFormulario<EstadoPaciente>(fusionarAccion, {});
  return (
    <form onSubmit={alEnviar} className="grid gap-4">
      <input type="hidden" name="actual" value={actual.id} />
      <input type="hidden" name="otra" value={otra.id} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Tarjeta r={actual} valor="actual" defecto />
        <Tarjeta r={otra} valor="otra" />
      </div>
      <p className="font-sans text-sm text-gris-600">
        La ficha que queda conserva sus propios datos. Si los datos correctos están en la otra, elige esa o corrígelos después.
      </p>
      <Casilla name="confirmo" value="si" etiqueta="Confirmo que las dos fichas son de la misma persona" />
      {estado.error && <Alerta tono="error">{estado.error}</Alerta>}
      <div>
        <Boton variante="peligro" pendiente={pendiente}>
          Fusionar fichas
        </Boton>
      </div>
    </form>
  );
}
