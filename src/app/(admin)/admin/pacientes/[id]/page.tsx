import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirPanel } from "@/lib/auth/servidor";
import { db } from "@/lib/db";
import { NOMBRES_ESTADO, type EstadoCita } from "@/modules/agenda/estados";
import { formatearFechaLarga, horaLocal } from "@/modules/agenda/tiempo";
import { obtenerFicha } from "@/modules/pacientes";
import { TIPOS_DOCUMENTO } from "@/modules/pacientes/documento";
import { EnlaceBoton, Titulo } from "@/components/panel/ui";
import { FormularioPaciente } from "../formulario-paciente";

export const metadata: Metadata = { title: "Paciente" };

type Props = { params: Promise<{ id: string }> };

export default async function FichaPaciente({ params }: Props) {
  const admin = await requerirPanel();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const ficha = await obtenerFicha(db(), id, { userId: admin.userId });
  if (!ficha) notFound();
  const { paciente, citas } = ficha;

  return (
    <div className="grid max-w-3xl gap-6">
      <Titulo accion={<EnlaceBoton href={`/admin/agenda/nueva?pacienteId=${paciente.id}`}>Nueva cita</EnlaceBoton>}>{paciente.nombre}</Titulo>
      <p className="font-sans text-sm text-gris-600">
        {paciente.celular_verificado_en ? "Celular verificado por la web." : "Celular sin verificar."} Ficha mínima: el CRM completo llega en la fase 4.
      </p>
      <FormularioPaciente paciente={paciente} tiposDocumento={Object.entries(TIPOS_DOCUMENTO).map(([valor, nombre]) => ({ valor, nombre }))} />
      <section className="grid gap-3">
        <h2 className="font-sans text-sm uppercase tracking-[0.14em] text-gris-600">Citas · {citas.length}</h2>
        {citas.length === 0 ? (
          <p className="font-sans text-sm text-gris-600">Sin citas.</p>
        ) : (
          <ul className="divide-y divide-gris-200 border border-gris-200 bg-white font-sans">
            {citas.map((c) => (
              <li key={c.id}>
                <Link href={`/admin/citas/${c.id}`} prefetch={false} className="flex min-h-12 flex-wrap items-center justify-between gap-2 px-4 py-2 hover:bg-papel">
                  <span className="inline-block first-letter:uppercase">
                    {formatearFechaLarga(c.inicio)} · {horaLocal(c.inicio)}
                  </span>
                  <span className="text-sm text-gris-600">
                    {c.servicioNombre} · {NOMBRES_ESTADO[c.estado as EstadoCita] ?? c.estado}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
