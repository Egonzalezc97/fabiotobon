import type { Metadata } from "next";
import { requerirAdmin } from "@/lib/auth/servidor";
import { POLITICAS_RESERVA } from "@/modules/servicios";
import { Titulo } from "@/components/panel/ui";
import { FormularioServicio } from "../formulario-servicio";

export const metadata: Metadata = { title: "Nuevo servicio" };

export default async function NuevoServicio() {
  await requerirAdmin();
  return (
    <div className="grid max-w-2xl gap-6">
      <Titulo>Nuevo servicio</Titulo>
      <FormularioServicio politicas={Object.entries(POLITICAS_RESERVA).map(([valor, nombre]) => ({ valor, nombre }))} />
    </div>
  );
}
