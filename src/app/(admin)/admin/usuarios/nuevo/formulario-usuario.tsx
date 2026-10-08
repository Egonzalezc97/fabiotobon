"use client";

import { useState, useTransition } from "react";
import { useAccionFormulario } from "@/components/usar-accion-formulario";
import { Alerta, Boton, CampoPanel, SelectorPanel } from "@/components/panel/ui";
import { crearUsuarioAccion, sugerirUsuarioAccion, type EstadoUsuario } from "../acciones";

/** Contraseña temporal legible (sin caracteres que se confunden), generada en el navegador. */
function generarTemporal(): string {
  const alfabeto = "abcdefghjkmnpqrstuvwxyz23456789";
  const valores = crypto.getRandomValues(new Uint32Array(16));
  return Array.from(valores, (v, i) => (i > 0 && i % 4 === 0 ? "-" : "") + alfabeto[v % alfabeto.length]).join("");
}

export function FormularioUsuario() {
  const { estado, alEnviar, pendiente } = useAccionFormulario<EstadoUsuario>(crearUsuarioAccion, {});
  const [usuario, setUsuario] = useState("");
  const [editado, setEditado] = useState(false);
  const [temporal, setTemporal] = useState("");
  const [, iniciar] = useTransition();

  function sugerir(nombre: string) {
    if (editado) return;
    iniciar(async () => setUsuario(await sugerirUsuarioAccion(nombre)));
  }

  return (
    <form onSubmit={alEnviar} className="grid gap-4 border border-gris-200 bg-white p-4">
      <CampoPanel etiqueta="Nombre completo" id="nombre" name="nombre" required onBlur={(e) => sugerir(e.currentTarget.value)} />
      <CampoPanel
        etiqueta="Nombre de usuario"
        id="usuario"
        name="usuario"
        required
        value={usuario}
        onChange={(e) => {
          setEditado(true);
          setUsuario(e.currentTarget.value.toLowerCase());
        }}
        autoCapitalize="none"
        spellCheck={false}
        ayuda="Sugerido a partir del nombre; puedes editarlo. Letras, números y punto; de 3 a 30 caracteres."
      />
      <CampoPanel
        etiqueta="Correo (opcional, recomendado)"
        id="correo"
        name="correo"
        type="email"
        ayuda="Servirá para recuperar la contraseña cuando el sistema envíe correos. Sin correo, solo un administrador puede ayudarle."
      />
      <SelectorPanel etiqueta="Rol" id="rol" name="rol" defaultValue="asistente">
        <option value="asistente">Asistente: agenda, pacientes, tratamientos y abonos</option>
        <option value="admin">Administrador: todo, incluidos usuarios y configuración</option>
      </SelectorPanel>
      <div className="grid gap-2">
        <CampoPanel
          etiqueta="Contraseña temporal (mínimo 12 caracteres)"
          id="contrasena"
          name="contrasena"
          required
          minLength={12}
          value={temporal}
          onChange={(e) => setTemporal(e.currentTarget.value)}
          autoComplete="off"
          className="font-mono"
        />
        <div>
          <Boton type="button" variante="secundario" onClick={() => setTemporal(generarTemporal())}>
            Generar contraseña temporal
          </Boton>
        </div>
      </div>
      {estado.error && <Alerta tono="error">{estado.error}</Alerta>}
      <div>
        <Boton pendiente={pendiente}>Crear usuario</Boton>
      </div>
    </form>
  );
}
