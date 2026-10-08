"use server";

import { revalidatePath } from "next/cache";
import { requerirPanel } from "@/lib/auth/servidor";
import { db } from "@/lib/db";
import { crearBloqueo, eliminarBloqueo, intervaloDeDias, type ResolucionCita } from "@/modules/agenda/bloqueos";
import { BloqueoConConflictos, ErrorAgenda } from "@/modules/agenda/errores";
import { aMinutos, esFechaLocal, instante } from "@/modules/agenda/tiempo";

export type CitaAfectadaVista = {
  id: string;
  inicio: string;
  fin: string;
  pacienteNombre: string;
  pacienteCelular: string | null;
  servicioNombre: string;
};

export type EstadoBloqueo = {
  error?: string;
  ok?: string;
  afectadas?: CitaAfectadaVista[];
  /** Pacientes cuyas citas se cancelaron o movieron: hay que avisarles a mano (sin mensajes hasta la fase 3). */
  avisar?: { nombre: string; celular: string | null; accion: string }[];
};

const texto = (f: FormData, clave: string) => String(f.get(clave) ?? "").trim();
const HORA = /^\d{2}:\d{2}$/;

function leerIntervalo(f: FormData) {
  if (texto(f, "tipo") === "dias") {
    const desde = texto(f, "desdeFecha");
    const hasta = texto(f, "hastaFecha") || desde;
    if (!esFechaLocal(desde) || !esFechaLocal(hasta) || hasta < desde) return null;
    return { ...intervaloDeDias(desde, hasta), diaCompleto: true };
  }
  const fecha = texto(f, "fecha");
  const desde = texto(f, "desde");
  const hasta = texto(f, "hasta");
  if (!esFechaLocal(fecha) || !HORA.test(desde) || !HORA.test(hasta)) return null;
  return { inicio: instante(fecha, aMinutos(desde)), fin: instante(fecha, aMinutos(hasta)), diaCompleto: false };
}

function leerResoluciones(f: FormData): ResolucionCita[] | string {
  const resoluciones: ResolucionCita[] = [];
  for (const citaId of f.getAll("afectada").map(String)) {
    const accion = texto(f, `accion_${citaId}`);
    if (accion === "cancelar") resoluciones.push({ citaId, accion });
    else if (accion === "reprogramar") {
      const fecha = texto(f, `fecha_${citaId}`);
      const hora = texto(f, `hora_${citaId}`);
      if (!esFechaLocal(fecha) || !HORA.test(hora)) return "Elige la nueva fecha y hora de cada cita que vas a mover.";
      resoluciones.push({
        citaId,
        accion,
        nuevoInicio: instante(fecha, aMinutos(hora)),
        permitirFueraDeHorario: f.get(`fuera_${citaId}`) === "si",
      });
    } else return "Decide qué hacer con cada cita afectada.";
  }
  return resoluciones;
}

export async function crearBloqueoAccion(_previo: EstadoBloqueo, f: FormData): Promise<EstadoBloqueo> {
  const admin = await requerirPanel();
  const intervalo = leerIntervalo(f);
  if (!intervalo || !(intervalo.fin > intervalo.inicio)) return { error: "Revisa las fechas y horas del bloqueo." };
  const resoluciones = leerResoluciones(f);
  if (typeof resoluciones === "string") return { error: resoluciones, afectadas: _previo.afectadas };

  try {
    await crearBloqueo(db(), { ...intervalo, motivo: texto(f, "motivo") }, resoluciones, {
      actor: { tipo: "usuario", id: admin.userId },
    });
  } catch (error) {
    if (error instanceof BloqueoConConflictos) {
      return {
        error: "El bloqueo se cruza con citas. Decide qué hacer con cada una; no se guarda nada hasta que confirmes.",
        afectadas: error.afectadas.map((c) => ({ ...c, inicio: c.inicio.toISOString(), fin: c.fin.toISOString() })),
      };
    }
    if (error instanceof ErrorAgenda) return { error: `No se guardó nada. ${error.message}`, afectadas: _previo.afectadas };
    throw error;
  }
  revalidatePath("/admin", "layout");
  const afectadas = new Map((_previo.afectadas ?? []).map((c) => [c.id, c]));
  return {
    ok: "Bloqueo guardado.",
    avisar: resoluciones.map((r) => ({
      nombre: afectadas.get(r.citaId)?.pacienteNombre ?? "Paciente",
      celular: afectadas.get(r.citaId)?.pacienteCelular ?? null,
      accion: r.accion === "cancelar" ? "cancelada" : "reprogramada",
    })),
  };
}

export async function eliminarBloqueoAccion(f: FormData): Promise<void> {
  const admin = await requerirPanel();
  await eliminarBloqueo(db(), texto(f, "id"), { actor: { tipo: "usuario", id: admin.userId } });
  revalidatePath("/admin", "layout");
}
