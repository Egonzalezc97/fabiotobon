"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { BotonPrincipal, Campo, MensajeError } from "@/components/campo";
import { authCliente } from "@/lib/auth/cliente";

/** Desactivar el 2FA pide la contraseña (lo exige Better Auth). Queda en auditoría (hook en lib/auth). */
export function DesactivarSegundoFactor() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function desactivar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const contrasena = String(new FormData(evento.currentTarget).get("contrasena"));
    setCargando(true);
    setError(null);
    const { error } = await authCliente.twoFactor.disable({ password: contrasena });
    setCargando(false);
    if (error) {
      setError(error.status === 429 ? "Demasiados intentos. Espera unos minutos." : "Contraseña incorrecta.");
      return;
    }
    router.refresh();
  }

  return (
    <form method="post" onSubmit={desactivar} className="mt-4 max-w-sm space-y-5">
      <Campo etiqueta="Confirma tu contraseña" id="contrasena-desactivar" name="contrasena" type="password" autoComplete="current-password" required />
      <MensajeError mensaje={error} />
      <BotonPrincipal cargando={cargando}>{cargando ? "Desactivando…" : "Desactivar"}</BotonPrincipal>
    </form>
  );
}
