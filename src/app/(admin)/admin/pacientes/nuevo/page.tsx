import type { Metadata } from "next";
import { requerirPanel } from "@/lib/auth/servidor";
import { TIPOS_DOCUMENTO } from "@/modules/pacientes/documento";
import { Titulo } from "@/components/panel/ui";
import { FormularioPaciente } from "../formulario-paciente";

export const metadata: Metadata = { title: "Nuevo paciente" };

export default async function NuevoPaciente() {
  await requerirPanel();
  return (
    <div className="grid max-w-2xl gap-6">
      <Titulo>Nuevo paciente</Titulo>
      <FormularioPaciente tiposDocumento={Object.entries(TIPOS_DOCUMENTO).map(([valor, nombre]) => ({ valor, nombre }))} />
    </div>
  );
}
