"use client";

import { BotonPrincipal, Campo, MensajeError } from "@/components/campo";
import { useAccionFormulario } from "@/components/usar-accion-formulario";
import { cambiarContrasenaAccion, type EstadoCambio } from "./acciones";

export function FormularioCambio() {
  const { estado, alEnviar, pendiente } = useAccionFormulario<EstadoCambio>(cambiarContrasenaAccion, {});
  return (
    <form method="post" onSubmit={alEnviar} className="mt-8 space-y-5">
      <Campo etiqueta="Contraseña temporal" id="actual" name="actual" type="password" autoComplete="current-password" required />
      <Campo etiqueta="Contraseña nueva (mínimo 12 caracteres)" id="nueva" name="nueva" type="password" autoComplete="new-password" minLength={12} required />
      <Campo etiqueta="Repite la contraseña nueva" id="confirmacion" name="confirmacion" type="password" autoComplete="new-password" required />
      <MensajeError mensaje={estado.error ?? null} />
      <BotonPrincipal cargando={pendiente}>{pendiente ? "Guardando…" : "Cambiar contraseña"}</BotonPrincipal>
    </form>
  );
}
