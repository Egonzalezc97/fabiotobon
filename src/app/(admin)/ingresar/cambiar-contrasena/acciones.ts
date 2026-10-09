"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { estadoAccesoActual } from "@/lib/auth/servidor";
import { cambiarContrasenaPropia, ErrorUsuarios } from "@/lib/auth/usuarios";
import { db } from "@/lib/db";

export type EstadoCambio = { error?: string };

// Única acción del flujo de acceso que no exige rol: la usa quien entró con una contraseña temporal.
// Verifica en el servidor que la sesión esté justamente en ese estado.
export async function cambiarContrasenaAccion(_previo: EstadoCambio, f: FormData): Promise<EstadoCambio> {
  const estado = await estadoAccesoActual();
  if (estado.tipo !== "debe_cambiar_contrasena") redirect("/ingresar");
  const nueva = String(f.get("nueva") ?? "");
  if (nueva !== String(f.get("confirmacion") ?? "")) return { error: "Las contraseñas nuevas no coinciden." };
  try {
    await cambiarContrasenaPropia(auth(), db(), await headers(), { actual: String(f.get("actual") ?? ""), nueva }, estado.userId);
  } catch (error) {
    if (error instanceof ErrorUsuarios) return { error: error.message };
    throw error;
  }
  redirect("/admin");
}
