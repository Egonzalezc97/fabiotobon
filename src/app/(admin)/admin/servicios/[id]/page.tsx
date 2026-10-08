import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requerirAdmin } from "@/lib/auth/servidor";
import { db } from "@/lib/db";
import { obtenerServicio, POLITICAS_RESERVA } from "@/modules/servicios";
import { Titulo } from "@/components/panel/ui";
import { FormularioServicio } from "../formulario-servicio";

export const metadata: Metadata = { title: "Servicio" };

type Props = { params: Promise<{ id: string }> };

export default async function EditarServicio({ params }: Props) {
  await requerirAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const servicio = await obtenerServicio(db(), id);
  if (!servicio) notFound();
  return (
    <div className="grid max-w-2xl gap-6">
      <Titulo>{servicio.nombre}</Titulo>
      <p className="font-sans text-sm text-gris-600">Cambiar la duración solo afecta las citas nuevas. Los servicios no se borran: se desactivan.</p>
      <FormularioServicio servicio={servicio} politicas={Object.entries(POLITICAS_RESERVA).map(([valor, nombre]) => ({ valor, nombre }))} />
    </div>
  );
}
