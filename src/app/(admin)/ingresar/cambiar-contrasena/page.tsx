import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { estadoAccesoActual } from "@/lib/auth/servidor";
import { PantallaAcceso } from "../pantalla-acceso";
import { TituloAcceso } from "../titulo-acceso";
import { FormularioCambio } from "./formulario-cambio";

export const metadata: Metadata = {
  title: "Cambia tu contraseña",
  robots: { index: false, follow: false },
};

export default async function CambiarContrasena() {
  const estado = await estadoAccesoActual();
  if (estado.tipo !== "debe_cambiar_contrasena") redirect("/ingresar");
  return (
    <PantallaAcceso>
      <TituloAcceso>Cambia tu contraseña</TituloAcceso>
      <p className="mt-3 text-gris-600">
        Entraste con una contraseña temporal. Elige una propia; solo tú la conocerás. Después activarás la verificación en dos pasos.
      </p>
      <FormularioCambio />
    </PantallaAcceso>
  );
}
