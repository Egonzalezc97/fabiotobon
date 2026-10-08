import type { Metadata } from "next";
import { requerirAdmin } from "@/lib/auth/servidor";
import { db } from "@/lib/db";
import { leerHorarioMinutos } from "@/modules/agenda/horario";
import { aHora } from "@/modules/agenda/tiempo";
import { leerParametros } from "@/modules/configuracion";
import { Titulo } from "@/components/panel/ui";
import { FormularioHorario } from "./formulario-horario";

export const metadata: Metadata = { title: "Horario laboral" };

export default async function Horario() {
  await requerirAdmin();
  const [horario, { granularidadMin }] = await Promise.all([leerHorarioMinutos(db()), leerParametros(db())]);
  const inicial: Record<number, { inicio: string; fin: string }[]> = {};
  for (const [dia, tramos] of Object.entries(horario)) {
    inicial[Number(dia)] = [...(tramos ?? [])]
      .sort((a, b) => a.inicioMin - b.inicioMin)
      .map((t) => ({ inicio: aHora(t.inicioMin), fin: aHora(t.finMin) }));
  }
  return (
    <div className="grid max-w-2xl gap-6">
      <Titulo>Horario laboral</Titulo>
      <p className="font-sans text-sm text-gris-600">
        Es la base de los cupos que se ofrecen en la web y de lo que se muestra en la landing. Los bloqueos puntuales van en Bloqueos.
      </p>
      <FormularioHorario inicial={inicial} pasoMinutos={granularidadMin} />
    </div>
  );
}
