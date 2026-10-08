"use server";

import { revalidatePath } from "next/cache";
import { requerirAdmin } from "@/lib/auth/servidor";
import { db } from "@/lib/db";
import type { HorarioSemanal } from "@/modules/agenda/disponibilidad";
import { guardarHorario } from "@/modules/agenda/horario";
import { aMinutos } from "@/modules/agenda/tiempo";

export type EstadoHorario = { error?: string; ok?: string; fueraDeHorario?: { id: string; inicio: string; pacienteNombre: string }[] };

const HORA = /^\d{2}:\d{2}$/;

/** El formulario envía, por día, pares tramo_<dia>_<n>_inicio / _fin. Un par vacío se ignora. */
function leerHorario(f: FormData): HorarioSemanal | string {
  const horario: HorarioSemanal = {};
  for (let dia = 1; dia <= 7; dia++) {
    for (let n = 0; n < 3; n++) {
      const inicio = String(f.get(`tramo_${dia}_${n}_inicio`) ?? "");
      const fin = String(f.get(`tramo_${dia}_${n}_fin`) ?? "");
      if (!inicio && !fin) continue;
      if (!HORA.test(inicio) || !HORA.test(fin)) return "Completa la hora de inicio y de fin de cada tramo.";
      if (aMinutos(fin) <= aMinutos(inicio)) return "Cada tramo debe terminar después de empezar.";
      (horario[dia] ??= []).push({ inicioMin: aMinutos(inicio), finMin: aMinutos(fin) });
    }
  }
  return horario;
}

export async function guardarHorarioAccion(_previo: EstadoHorario, f: FormData): Promise<EstadoHorario> {
  const admin = await requerirAdmin();
  const horario = leerHorario(f);
  if (typeof horario === "string") return { error: horario };
  try {
    const { fueraDeHorario } = await guardarHorario(db(), horario, { actor: { tipo: "usuario", id: admin.userId } });
    revalidatePath("/", "layout");
    return {
      ok: "Horario guardado.",
      fueraDeHorario: fueraDeHorario.map((c) => ({ id: c.id, inicio: c.inicio.toISOString(), pacienteNombre: c.pacienteNombre })),
    };
  } catch (error) {
    if ((error as { constraint?: string }).constraint === "horario_laboral_sin_solapes") {
      return { error: "Hay tramos que se cruzan en un mismo día." };
    }
    throw error;
  }
}
