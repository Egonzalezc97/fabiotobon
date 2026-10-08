"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requerirPanel } from "@/lib/auth/servidor";
import { db } from "@/lib/db";
import { cambiarEstadoCita, cancelarCita, crearCita, reprogramarCita, resolverRevisionVinculando, type EstadoCita } from "@/modules/agenda/citas";
import { ErrorAgenda, FueraDeHorario } from "@/modules/agenda/errores";
import { esFechaLocal, fechaLocal, instante } from "@/modules/agenda/tiempo";
import { buscarPacientes, crearPaciente, DatosPacienteInvalidos, DocumentoDuplicado, type ResultadoBusqueda } from "@/modules/pacientes";

// Acciones del panel sobre citas. Cada una exige sesión con segundo factor y rol admin o asistente (requerirPanel) antes de todo.

export type EstadoAccion = { error?: string; fueraDeHorario?: boolean; ok?: string };

const texto = (f: FormData, clave: string) => String(f.get(clave) ?? "").trim();

/** "2026-11-02" + "09:30" en hora de Bogotá → instante UTC. */
function leerInicio(f: FormData): Date | null {
  const fecha = texto(f, "fecha");
  const hora = /^(\d{2}):(\d{2})$/.exec(texto(f, "hora"));
  if (!esFechaLocal(fecha) || !hora) return null;
  return instante(fecha, Number(hora[1]) * 60 + Number(hora[2]));
}

function traducir(error: unknown): EstadoAccion {
  if (error instanceof FueraDeHorario) return { error: error.message, fueraDeHorario: true };
  if (error instanceof ErrorAgenda || error instanceof DatosPacienteInvalidos) return { error: error.message };
  if (error instanceof DocumentoDuplicado) return { error: "Ya existe un paciente con ese documento. Búscalo en lugar de crearlo." };
  throw error;
}

export async function buscarPacientesAccion(termino: string): Promise<ResultadoBusqueda[]> {
  const admin = await requerirPanel();
  return buscarPacientes(db(), String(termino), { userId: admin.userId });
}

export async function crearCitaAccion(_previo: EstadoAccion, f: FormData): Promise<EstadoAccion> {
  const admin = await requerirPanel();
  const inicio = leerInicio(f);
  if (!inicio) return { error: "Elige fecha y hora." };
  const servicioId = texto(f, "servicioId");
  if (!servicioId) return { error: "Elige un servicio." };
  const estado = texto(f, "estado") === "pendiente" ? "pendiente" : "confirmada";
  const actor = { tipo: "usuario" as const, id: admin.userId };

  try {
    await db()
      .transaction()
      .execute(async (trx) => {
        let pacienteId = texto(f, "pacienteId");
        if (texto(f, "modoPaciente") === "nuevo") {
          pacienteId = (
            await crearPaciente(
              trx,
              {
                tipoDocumento: texto(f, "tipoDocumento"),
                numeroDocumento: texto(f, "numeroDocumento"),
                nombre: texto(f, "nombre"),
                celular: texto(f, "celular"),
                correo: texto(f, "correo"),
              },
              { userId: admin.userId },
            )
          ).id;
        }
        if (!pacienteId) throw new DatosPacienteInvalidos("Elige un paciente o crea uno nuevo.");
        await crearCita(
          trx,
          { pacienteId, servicioId, inicio, estado, origen: "panel", notasInternas: texto(f, "notas").slice(0, 2000) },
          { modo: "panel", permitirFueraDeHorario: f.get("fueraDeHorario") === "si", actor },
        );
      });
  } catch (error) {
    return traducir(error);
  }
  revalidatePath("/admin", "layout");
  redirect(`/admin/agenda?fecha=${fechaLocal(inicio)}&vista=dia`);
}

export async function reprogramarAccion(_previo: EstadoAccion, f: FormData): Promise<EstadoAccion> {
  const admin = await requerirPanel();
  const inicio = leerInicio(f);
  if (!inicio) return { error: "Elige fecha y hora." };
  try {
    await reprogramarCita(db(), texto(f, "citaId"), inicio, {
      actor: { tipo: "usuario", id: admin.userId },
      permitirFueraDeHorario: f.get("fueraDeHorario") === "si",
    });
  } catch (error) {
    return traducir(error);
  }
  revalidatePath("/admin", "layout");
  return { ok: "Cita reprogramada." };
}

export async function cancelarAccion(_previo: EstadoAccion, f: FormData): Promise<EstadoAccion> {
  const admin = await requerirPanel();
  try {
    await cancelarCita(db(), texto(f, "citaId"), { actor: { tipo: "usuario", id: admin.userId }, motivo: texto(f, "motivo") });
  } catch (error) {
    return traducir(error);
  }
  revalidatePath("/admin", "layout");
  return { ok: "Cita cancelada. Recuerda avisarle al paciente: aún no se envían mensajes automáticos." };
}

const ESTADOS: EstadoCita[] = ["pendiente", "confirmada", "cumplida", "no_asistio"];

export async function cambiarEstadoAccion(_previo: EstadoAccion, f: FormData): Promise<EstadoAccion> {
  const admin = await requerirPanel();
  const estado = texto(f, "estado") as EstadoCita;
  if (!ESTADOS.includes(estado)) return { error: "Estado no válido." };
  try {
    await cambiarEstadoCita(db(), texto(f, "citaId"), estado, { actor: { tipo: "usuario", id: admin.userId } });
  } catch (error) {
    return traducir(error);
  }
  revalidatePath("/admin", "layout");
  return { ok: "Estado actualizado." };
}

export async function resolverRevisionAccion(_previo: EstadoAccion, f: FormData): Promise<EstadoAccion> {
  const admin = await requerirPanel();
  try {
    await resolverRevisionVinculando(db(), texto(f, "citaId"), { actor: { tipo: "usuario", id: admin.userId } });
  } catch (error) {
    return traducir(error);
  }
  revalidatePath("/admin", "layout");
  return { ok: "Identidad confirmada. La autorización de datos quedó vinculada a la ficha." };
}
