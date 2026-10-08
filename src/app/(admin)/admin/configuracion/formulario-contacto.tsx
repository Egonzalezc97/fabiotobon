"use client";

import { useAccionFormulario } from "@/components/usar-accion-formulario";
import { Alerta, Boton, CampoPanel } from "@/components/panel/ui";
import type { DatosContacto } from "@/modules/configuracion";
import { guardarContactoAccion, type EstadoConfiguracion } from "./acciones";

/** Datos de contacto que se muestran en el sitio. Un campo vacío aparece como "[PENDIENTE: …]". */
export function FormularioContacto({ contacto }: { contacto: DatosContacto }) {
  const { estado, alEnviar, pendiente } = useAccionFormulario<EstadoConfiguracion>(guardarContactoAccion, {});
  return (
    <form onSubmit={alEnviar} className="grid gap-4 border border-gris-200 bg-white p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoPanel
          etiqueta="WhatsApp"
          id="whatsapp"
          name="whatsapp"
          type="tel"
          defaultValue={contacto.whatsapp ? `+${contacto.whatsapp}` : ""}
          placeholder="+57 323 345 6845"
          ayuda="Con indicativo del país. Lo usan todos los botones de WhatsApp."
        />
        <CampoPanel etiqueta="Teléfono" id="telefono" name="telefono" type="tel" defaultValue={contacto.telefono ?? ""} />
        <div className="sm:col-span-2">
          <CampoPanel
            etiqueta="Mensaje inicial de WhatsApp"
            id="mensajeWhatsapp"
            name="mensajeWhatsapp"
            maxLength={200}
            defaultValue={contacto.mensajeWhatsapp ?? ""}
            ayuda="Se escribe solo cuando alguien abre WhatsApp desde el sitio. Puede editarlo antes de enviar."
          />
        </div>
        <CampoPanel etiqueta="Dirección" id="direccion" name="direccion" defaultValue={contacto.direccion ?? ""} />
        <CampoPanel etiqueta="Ciudad" id="ciudad" name="ciudad" defaultValue={contacto.ciudad ?? ""} />
        <CampoPanel etiqueta="Correo" id="correo" name="correo" type="email" defaultValue={contacto.correo ?? ""} />
        <CampoPanel etiqueta="Registro profesional" id="registroProfesional" name="registroProfesional" defaultValue={contacto.registroProfesional ?? ""} />
      </div>
      <p className="font-sans text-xs text-gris-600">Deja vacío lo que aún no quieras publicar: el sitio lo mostrará como pendiente.</p>
      {estado.error && <Alerta tono="error">{estado.error}</Alerta>}
      {estado.ok && <Alerta tono="ok">{estado.ok}</Alerta>}
      <div>
        <Boton pendiente={pendiente}>Guardar datos de contacto</Boton>
      </div>
    </form>
  );
}
