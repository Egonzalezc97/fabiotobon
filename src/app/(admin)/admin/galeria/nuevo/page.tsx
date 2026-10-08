import type { Metadata } from "next";
import Link from "next/link";
import { requerirAdmin } from "@/lib/auth/servidor";
import { Titulo } from "@/components/panel/ui";
import { opcionesCaso } from "../datos";
import { FormularioCaso } from "../formulario-caso";

export const metadata: Metadata = { title: "Nuevo caso" };

export default async function NuevoCaso() {
  await requerirAdmin();
  const opciones = await opcionesCaso();
  return (
    <div className="grid max-w-3xl gap-6">
      <Link href="/admin/galeria" className="font-sans text-sm text-gris-600 underline underline-offset-4">
        ← Galería
      </Link>
      <Titulo>Nuevo caso</Titulo>
      <FormularioCaso {...opciones} />
    </div>
  );
}
