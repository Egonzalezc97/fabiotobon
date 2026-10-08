"use client";

import { useAccionFormulario } from "@/components/usar-accion-formulario";
import { Alerta, Boton, CampoPanel, Casilla } from "@/components/panel/ui";
import type { DatosContacto } from "@/modules/configuracion";
import { guardarContactoAccion, type EstadoConfiguracion } from "./acciones";

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={titulo} className="grid gap-4 border-t border-gris-200 pt-4 first:border-t-0 first:pt-0 sm:grid-cols-2">
      <h3 className="font-sans text-xs uppercase tracking-[0.14em] text-gris-600 sm:col-span-2">{titulo}</h3>
      {children}
    </div>
  );
}

function Ancho({ children }: { children: React.ReactNode }) {
  return <div className="sm:col-span-2">{children}</div>;
}

/** Datos de contacto que se muestran en el sitio. Un campo vacío aparece como "[PENDIENTE: …]". */
export function FormularioContacto({ contacto }: { contacto: DatosContacto }) {
  const { estado, alEnviar, pendiente } = useAccionFormulario<EstadoConfiguracion>(guardarContactoAccion, {});
  return (
    <form onSubmit={alEnviar} className="grid gap-6 border border-gris-200 bg-white p-4">
      <Grupo titulo="Profesional">
        <CampoPanel
          etiqueta="Especialidad"
          id="especialidad"
          name="especialidad"
          maxLength={60}
          defaultValue={contacto.especialidad ?? ""}
          ayuda="Encabezado del sitio y título de la pestaña."
        />
        <CampoPanel etiqueta="Registro profesional" id="registroProfesional" name="registroProfesional" defaultValue={contacto.registroProfesional ?? ""} />
      </Grupo>

      <Grupo titulo="Ubicación">
        <CampoPanel etiqueta="Dirección" id="direccion" name="direccion" defaultValue={contacto.direccion ?? ""} />
        <CampoPanel etiqueta="Ciudad" id="ciudad" name="ciudad" defaultValue={contacto.ciudad ?? ""} />
        <Ancho>
          <CampoPanel
            etiqueta="Referencia de ubicación"
            id="referencia"
            name="referencia"
            maxLength={200}
            defaultValue={contacto.referencia ?? ""}
            ayuda="Cómo llegar en pocas palabras. Sale en el sitio y en los mensajes de las citas."
          />
        </Ancho>
      </Grupo>

      <Grupo titulo="Canales">
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
        <Ancho>
          <CampoPanel
            etiqueta="Mensaje inicial de WhatsApp"
            id="mensajeWhatsapp"
            name="mensajeWhatsapp"
            maxLength={200}
            defaultValue={contacto.mensajeWhatsapp ?? ""}
            ayuda="Se escribe solo cuando alguien abre WhatsApp desde el sitio. Puede editarlo antes de enviar."
          />
        </Ancho>
        <CampoPanel etiqueta="Correo" id="correo" name="correo" type="email" defaultValue={contacto.correo ?? ""} />
      </Grupo>

      <Grupo titulo="Redes">
        <CampoPanel
          etiqueta="Instagram"
          id="instagram"
          name="instagram"
          defaultValue={contacto.instagram ?? ""}
          placeholder="https://instagram.com/usuario"
          ayuda="La dirección del perfil o solo el usuario."
        />
        <CampoPanel
          etiqueta="Facebook"
          id="facebook"
          name="facebook"
          defaultValue={contacto.facebook ?? ""}
          placeholder="https://facebook.com/usuario"
          ayuda="La dirección de la página o solo el usuario."
        />
      </Grupo>

      <Grupo titulo="Urgencias">
        <Ancho>
          <Casilla
            etiqueta="Mostrar la franja de urgencias en el sitio"
            name="urgenciasActiva"
            value="si"
            defaultChecked={contacto.urgenciasActiva}
          />
        </Ancho>
        <CampoPanel etiqueta="Texto" id="urgenciasTexto" name="urgenciasTexto" maxLength={60} defaultValue={contacto.urgenciasTexto ?? ""} />
        <CampoPanel
          etiqueta="Número de llamada"
          id="urgenciasTelefono"
          name="urgenciasTelefono"
          type="tel"
          defaultValue={contacto.urgenciasTelefono ?? ""}
          placeholder="+57 323 345 6845"
          ayuda="El botón «Llamar ahora» marca este número."
        />
      </Grupo>

      <p className="font-sans text-xs text-gris-600">Deja vacío lo que aún no quieras publicar: el sitio lo mostrará como pendiente.</p>
      {estado.error && <Alerta tono="error">{estado.error}</Alerta>}
      {estado.ok && <Alerta tono="ok">{estado.ok}</Alerta>}
      <div>
        <Boton pendiente={pendiente}>Guardar datos de contacto</Boton>
      </div>
    </form>
  );
}
