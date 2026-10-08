"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requerirAdmin } from "@/lib/auth/servidor";
import { db } from "@/lib/db";
import { actualizarPaciente, crearPaciente, DatosPacienteInvalidos, DocumentoDuplicado } from "@/modules/pacientes";

export type EstadoPaciente = { error?: string; ok?: string };

const texto = (f: FormData, clave: string) => String(f.get(clave) ?? "").trim();

function datos(f: FormData) {
  return {
    tipoDocumento: texto(f, "tipoDocumento"),
    numeroDocumento: texto(f, "numeroDocumento"),
    nombre: texto(f, "nombre"),
    celular: texto(f, "celular"),
    correo: texto(f, "correo"),
    notas: texto(f, "notas"),
  };
}

function traducir(error: unknown): EstadoPaciente {
  if (error instanceof DatosPacienteInvalidos || error instanceof DocumentoDuplicado) return { error: error.message };
  throw error;
}

export async function crearPacienteAccion(_previo: EstadoPaciente, f: FormData): Promise<EstadoPaciente> {
  const admin = await requerirAdmin();
  let id: string;
  try {
    id = (await crearPaciente(db(), datos(f), { userId: admin.userId })).id;
  } catch (error) {
    return traducir(error);
  }
  redirect(`/admin/pacientes/${id}`);
}

export async function actualizarPacienteAccion(_previo: EstadoPaciente, f: FormData): Promise<EstadoPaciente> {
  const admin = await requerirAdmin();
  const estado = texto(f, "estado") === "inactivo" ? "inactivo" : "activo";
  try {
    await actualizarPaciente(db(), texto(f, "id"), { ...datos(f), estado }, { userId: admin.userId });
  } catch (error) {
    return traducir(error);
  }
  revalidatePath(`/admin/pacientes/${texto(f, "id")}`);
  return { ok: "Datos guardados." };
}
