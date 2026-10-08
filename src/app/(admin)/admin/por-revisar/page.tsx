import type { Metadata } from "next";
import { requerirAdmin } from "@/lib/auth/servidor";
import { db } from "@/lib/db";
import { listarPorRevisar, type CitaAgenda } from "@/modules/agenda/consultas";
import { formatearFechaLarga, horaLocal } from "@/modules/agenda/tiempo";
import { Titulo } from "@/components/panel/ui";
import { EnlaceCita, textoEstado } from "../agenda/bloque-cita";

export const metadata: Metadata = { title: "Por revisar" };

function Lista({ citas, vacia }: { citas: CitaAgenda[]; vacia: string }) {
  if (citas.length === 0) return <p className="font-sans text-sm text-gris-600">{vacia}</p>;
  return (
    <ul className="grid gap-2">
      {citas.map((c) => (
        <li key={c.id}>
          <EnlaceCita cita={c} className="flex min-h-14 flex-wrap items-center justify-between gap-2 border border-gris-200 bg-white px-4 py-3 font-sans hover:border-gris-800">
            <span>
              <span className="font-medium">{c.pacienteNombre}</span>
              <span className="block text-sm text-gris-600">
                {c.servicioNombre} · {textoEstado(c.estado)}
              </span>
            </span>
            <span className="inline-block text-sm tabular-nums first-letter:uppercase">
              {formatearFechaLarga(c.inicio)} · {horaLocal(c.inicio)}
            </span>
          </EnlaceCita>
        </li>
      ))}
    </ul>
  );
}

// Mientras no haya avisos (fase 3), Fabio se entera aquí de las reservas web. Se marcan como vistas al abrirlas.
export default async function PorRevisar() {
  await requerirAdmin();
  const [revision, nuevas] = await Promise.all([listarPorRevisar(db(), "revision"), listarPorRevisar(db(), "nuevas")]);
  return (
    <div className="grid max-w-3xl gap-8">
      <Titulo>Por revisar</Titulo>
      <section className="grid gap-3">
        <h2 className="font-sans text-sm uppercase tracking-[0.14em] text-red-700">Marcadas para revisión · {revision.length}</h2>
        <p className="font-sans text-sm text-gris-600">
          Reservas con un documento que ya existía pero desde otro celular, o sin documento. Confirma la identidad antes de la cita.
        </p>
        <Lista citas={revision} vacia="Nada pendiente." />
      </section>
      <section className="grid gap-3">
        <h2 className="font-sans text-sm uppercase tracking-[0.14em] text-azul">Reservas web nuevas · {nuevas.length}</h2>
        <Lista citas={nuevas} vacia="No hay reservas web sin abrir." />
      </section>
    </div>
  );
}
