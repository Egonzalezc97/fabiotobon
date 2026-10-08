import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { estadoAccesoActual } from "@/lib/auth/servidor";
import { BotonCerrarSesion } from "../boton-cerrar-sesion";
import { FormularioIngreso } from "./formulario-ingreso";

export const metadata: Metadata = {
  title: "Ingresar · Fabio Tobón Odontología",
  robots: { index: false, follow: false },
};

export default async function Ingresar() {
  const estado = await estadoAccesoActual();
  if (estado.tipo === "admin") redirect("/admin");
  if (estado.tipo === "sin_segundo_factor") redirect("/ingresar/segundo-factor");

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-16">
      <h1 className="text-2xl font-semibold">Ingresar al panel</h1>
      {estado.tipo === "sin_permiso" ? (
        <div className="mt-6 space-y-4">
          <p className="text-tinta-suave">Esta cuenta no tiene acceso al panel.</p>
          <BotonCerrarSesion />
        </div>
      ) : (
        <FormularioIngreso />
      )}
    </main>
  );
}
