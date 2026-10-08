import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { estadoAccesoActual } from "@/lib/auth/servidor";
import { PantallaAcceso } from "../pantalla-acceso";
import { TituloAcceso } from "../titulo-acceso";
import { ActivarSegundoFactor } from "./activar-segundo-factor";

export const metadata: Metadata = {
  title: "Activar verificación en dos pasos",
  robots: { index: false, follow: false },
};

export default async function SegundoFactor() {
  const estado = await estadoAccesoActual();
  if (estado.tipo === "admin") redirect("/admin");
  if (estado.tipo !== "sin_segundo_factor") redirect("/ingresar");

  return (
    <PantallaAcceso ancho="amplio">
      <TituloAcceso>Activa la verificación en dos pasos</TituloAcceso>
      <p className="mt-3 text-gris-600">
        El panel guarda datos de pacientes. Para entrar necesitas, además de la contraseña, un código de una
        aplicación autenticadora en tu celular (Google Authenticator, Microsoft Authenticator u otra).
      </p>
      <ActivarSegundoFactor />
    </PantallaAcceso>
  );
}
