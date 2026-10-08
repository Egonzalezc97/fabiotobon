"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authCliente } from "@/lib/auth/cliente";

export function BotonCerrarSesion() {
  const router = useRouter();
  const [saliendo, setSaliendo] = useState(false);

  async function salir() {
    setSaliendo(true);
    await authCliente.signOut();
    router.replace("/ingresar");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={salir}
      disabled={saliendo}
      className="text-sm text-tinta-suave underline-offset-4 hover:text-tinta hover:underline disabled:opacity-50"
    >
      {saliendo ? "Cerrando sesión…" : "Cerrar sesión"}
    </button>
  );
}
