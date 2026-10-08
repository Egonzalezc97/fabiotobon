import type { Metadata } from "next";
import { requerirAdmin } from "@/lib/auth/servidor";
import { Titulo } from "@/components/panel/ui";
import { FormularioUsuario } from "./formulario-usuario";

export const metadata: Metadata = { title: "Nuevo usuario" };

export default async function NuevoUsuario() {
  await requerirAdmin();
  return (
    <div className="grid max-w-2xl gap-6">
      <Titulo>Nuevo usuario</Titulo>
      <p className="font-sans text-sm text-gris-600">
        Define una contraseña temporal y entrégasela en persona. En su primer ingreso deberá cambiarla y activar la verificación en dos
        pasos.
      </p>
      <FormularioUsuario />
    </div>
  );
}
