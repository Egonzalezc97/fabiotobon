"use client";

import { useAccionFormulario } from "@/components/usar-accion-formulario";
import { Alerta, Boton, CampoPanel, Casilla, SelectorPanel } from "@/components/panel/ui";
import { guardarServicioAccion, type EstadoServicio } from "./acciones";

type Servicio = {
  id: string;
  nombre: string;
  descripcion: string;
  duracion_min: number;
  precio_cop: number | null;
  mostrar_precio: boolean;
  visible_en_landing: boolean;
  politica_reserva: string;
  orden: number;
  activo: boolean;
};

export function FormularioServicio({ servicio, politicas }: { servicio?: Servicio; politicas: { valor: string; nombre: string }[] }) {
  const { estado, alEnviar, pendiente } = useAccionFormulario<EstadoServicio>(guardarServicioAccion, {});
  return (
    <form onSubmit={alEnviar} className="grid gap-4 border border-gris-200 bg-white p-4">
      {servicio && <input type="hidden" name="id" value={servicio.id} />}
      <CampoPanel etiqueta="Nombre" id="nombre" name="nombre" defaultValue={servicio?.nombre} required maxLength={120} />
      <div>
        <label htmlFor="descripcion" className="block font-sans text-sm">
          Descripción (se muestra en la landing)
        </label>
        <textarea id="descripcion" name="descripcion" rows={3} maxLength={1000} defaultValue={servicio?.descripcion} className="mt-1 w-full rounded-[2px] border border-gris-200 p-3 font-sans outline-none focus:border-azul" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <CampoPanel etiqueta="Duración (min)" id="duracion" name="duracion" type="number" min={5} max={600} step={5} defaultValue={servicio?.duracion_min ?? 30} required />
        <CampoPanel etiqueta="Precio (COP)" id="precio" name="precio" inputMode="numeric" defaultValue={servicio?.precio_cop ?? ""} ayuda="Vacío si no hay precio." />
        <CampoPanel etiqueta="Orden" id="orden" name="orden" type="number" min={0} max={999} defaultValue={servicio?.orden ?? 0} />
      </div>
      <SelectorPanel etiqueta="Quién puede reservarlo" id="politicaReserva" name="politicaReserva" defaultValue={servicio?.politica_reserva ?? "solo_admin"}>
        {politicas.map((p) => (
          <option key={p.valor} value={p.valor}>
            {p.nombre}
          </option>
        ))}
      </SelectorPanel>
      <div className="grid gap-1">
        <Casilla name="mostrarPrecio" value="si" defaultChecked={servicio?.mostrar_precio ?? false} etiqueta="Mostrar el precio en la landing y en la reserva" />
        <Casilla name="visibleEnLanding" value="si" defaultChecked={servicio?.visible_en_landing ?? true} etiqueta="Visible en la landing" />
        <Casilla name="activo" value="si" defaultChecked={servicio?.activo ?? true} etiqueta="Activo (si lo desactivas, sus citas siguen vigentes)" />
      </div>
      {estado.error && <Alerta tono="error">{estado.error}</Alerta>}
      {estado.ok && <Alerta tono="ok">{estado.ok}</Alerta>}
      <div>
        <Boton pendiente={pendiente}>{servicio ? "Guardar cambios" : "Crear servicio"}</Boton>
      </div>
    </form>
  );
}
