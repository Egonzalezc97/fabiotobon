"use client";

import { useAccionFormulario } from "@/components/usar-accion-formulario";
import { Alerta, Boton, Casilla } from "@/components/panel/ui";
import { guardarAutorizacionAccion, guardarPoliticaAccion, type EstadoConfiguracion } from "./acciones";

const CLASE_AREA = "mt-1 w-full rounded-[2px] border border-gris-200 p-3 font-mono text-[0.8125rem] leading-relaxed outline-none focus:border-azul";

/** Texto de la casilla de la reserva. Guardar crea una versión nueva; las anteriores se conservan. */
export function FormularioAutorizacion({ texto, borrador }: { texto: string; borrador: boolean }) {
  const { estado, alEnviar, pendiente } = useAccionFormulario<EstadoConfiguracion>(guardarAutorizacionAccion, {});
  return (
    <form onSubmit={alEnviar} className="grid gap-4 border border-gris-200 bg-white p-4">
      <div>
        <label htmlFor="textoAutorizacion" className="block font-sans text-sm text-gris-800">
          Texto que acepta el paciente
        </label>
        <textarea id="textoAutorizacion" name="texto" rows={8} maxLength={20000} required defaultValue={texto} className={CLASE_AREA} />
      </div>
      <Casilla
        etiqueta="Es un borrador sin aprobar (no habilita la reserva en producción)"
        name="borrador"
        value="si"
        defaultChecked={borrador}
      />
      <p className="font-sans text-xs text-gris-600">
        Cada cambio queda como versión nueva: los pacientes que ya aceptaron conservan la versión que aceptaron.
      </p>
      {estado.error && <Alerta tono="error">{estado.error}</Alerta>}
      {estado.ok && <Alerta tono="ok">{estado.ok}</Alerta>}
      <div>
        <Boton pendiente={pendiente}>Guardar como versión nueva</Boton>
      </div>
    </form>
  );
}

/** Política de tratamiento de datos en markdown. Se publica sola cuando no le quedan marcadores. */
export function FormularioPolitica({ texto }: { texto: string }) {
  const { estado, alEnviar, pendiente } = useAccionFormulario<EstadoConfiguracion>(guardarPoliticaAccion, {});
  return (
    <form onSubmit={alEnviar} className="grid gap-4 border border-gris-200 bg-white p-4">
      <div>
        <label htmlFor="textoPolitica" className="block font-sans text-sm text-gris-800">
          Texto de la política (markdown)
        </label>
        <textarea id="textoPolitica" name="texto" rows={16} maxLength={50000} defaultValue={texto} className={CLASE_AREA} />
      </div>
      <p className="font-sans text-xs text-gris-600">
        No se publica mientras contenga [CORREO PARA SOLICITUDES], [FECHA… o la palabra BORRADOR.
      </p>
      {estado.error && <Alerta tono="error">{estado.error}</Alerta>}
      {estado.ok && <Alerta tono="ok">{estado.ok}</Alerta>}
      <div>
        <Boton pendiente={pendiente}>Guardar política</Boton>
      </div>
    </form>
  );
}
