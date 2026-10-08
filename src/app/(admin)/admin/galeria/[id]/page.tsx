import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirAdmin } from "@/lib/auth/servidor";
import { db } from "@/lib/db";
import { obtenerCaso } from "@/modules/galeria";
import { Titulo } from "@/components/panel/ui";
import { opcionesCaso } from "../datos";
import { FormularioCaso, PublicarCaso } from "../formulario-caso";

export const metadata: Metadata = { title: "Caso de galería" };

type Props = { params: Promise<{ id: string }> };

export default async function DetalleCaso({ params }: Props) {
  await requerirAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [caso, opciones] = await Promise.all([obtenerCaso(db(), id), opcionesCaso()]);
  if (!caso) notFound();

  return (
    <div className="grid max-w-3xl gap-6">
      <Link href="/admin/galeria" className="font-sans text-sm text-gris-600 underline underline-offset-4">
        ← Galería
      </Link>
      <Titulo>{caso.procedimiento}</Titulo>
      <PublicarCaso casoId={caso.id} publicado={caso.estado === "publicado"} conConsentimiento={Boolean(caso.consentimiento_imagen_id)} />
      <FormularioCaso caso={caso} {...opciones} />
    </div>
  );
}
