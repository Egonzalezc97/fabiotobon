import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { estadoAccesoActual } from "@/lib/auth/servidor";
import { BotonCerrarSesion } from "../boton-cerrar-sesion";
import { FormularioIngreso } from "./formulario-ingreso";
import { PantallaAcceso } from "./pantalla-acceso";
import { TituloAcceso } from "./titulo-acceso";

export const metadata: Metadata = {
  title: "Ingresar",
  robots: { index: false, follow: false },
};

export default async function Ingresar() {
  const estado = await estadoAccesoActual();
  if (estado.tipo === "autorizado") redirect("/admin");
  if (estado.tipo === "debe_cambiar_contrasena") redirect("/ingresar/cambiar-contrasena");

  return (
    <PantallaAcceso>
      {estado.tipo === "sin_permiso" ? (
        <div className="space-y-5">
          <TituloAcceso>Ingresar</TituloAcceso>
          <p className="text-gris-600">Esta cuenta no tiene acceso al panel.</p>
          <BotonCerrarSesion />
        </div>
      ) : (
        <FormularioIngreso />
      )}
    </PantallaAcceso>
  );
}
