"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { requerirAdmin } from "@/lib/auth/servidor";
import {
  cambiarActivo,
  cambiarRol,
  crearUsuario,
  ErrorUsuarios,
  forzarCambioContrasena,
  nombreUsuarioDisponible,
  reiniciarSegundoFactor,
  sugerirNombreUsuario,
  type Rol,
} from "@/lib/auth/usuarios";
import { db } from "@/lib/db";

// Panel → Usuarios. Solo administradores. Cada acción queda en auditoría con quién la hizo.

export type EstadoUsuario = { error?: string; ok?: string };

const texto = (f: FormData, clave: string) => String(f.get(clave) ?? "").trim();
const rol = (valor: string): Rol => (valor === "asistente" ? "asistente" : "admin");

function traducir(error: unknown): EstadoUsuario {
  if (error instanceof ErrorUsuarios) return { error: error.message };
  throw error;
}

export async function sugerirUsuarioAccion(nombre: string): Promise<string> {
  await requerirAdmin();
  const limpio = String(nombre).trim().slice(0, 120);
  return limpio.length < 2 ? "" : nombreUsuarioDisponible(db(), sugerirNombreUsuario(limpio));
}

export async function crearUsuarioAccion(_previo: EstadoUsuario, f: FormData): Promise<EstadoUsuario> {
  const admin = await requerirAdmin();
  let userId: string;
  try {
    ({ userId } = await crearUsuario(
      auth(),
      db(),
      {
        nombre: texto(f, "nombre"),
        usuario: texto(f, "usuario"),
        correo: texto(f, "correo"),
        rol: rol(texto(f, "rol")),
        contrasena: String(f.get("contrasena") ?? ""),
        temporal: true,
      },
      { userId: admin.userId },
    ));
  } catch (error) {
    return traducir(error);
  }
  revalidatePath("/admin/usuarios");
  redirect(`/admin/usuarios/${userId}?creado=1`);
}

export async function cambiarRolAccion(_previo: EstadoUsuario, f: FormData): Promise<EstadoUsuario> {
  const admin = await requerirAdmin();
  try {
    await cambiarRol(db(), texto(f, "userId"), rol(texto(f, "rol")), { userId: admin.userId });
  } catch (error) {
    return traducir(error);
  }
  revalidatePath("/admin/usuarios");
  return { ok: "Rol actualizado." };
}

export async function cambiarActivoAccion(_previo: EstadoUsuario, f: FormData): Promise<EstadoUsuario> {
  const admin = await requerirAdmin();
  const activo = texto(f, "activo") === "si";
  try {
    await cambiarActivo(db(), texto(f, "userId"), activo, { userId: admin.userId });
  } catch (error) {
    return traducir(error);
  }
  revalidatePath("/admin/usuarios");
  return { ok: activo ? "Usuario reactivado." : "Usuario desactivado. Se cerraron sus sesiones." };
}

export async function forzarCambioAccion(_previo: EstadoUsuario, f: FormData): Promise<EstadoUsuario> {
  const admin = await requerirAdmin();
  try {
    await forzarCambioContrasena(auth(), db(), texto(f, "userId"), String(f.get("temporal") ?? ""), { userId: admin.userId });
  } catch (error) {
    return traducir(error);
  }
  revalidatePath("/admin/usuarios");
  return { ok: "Contraseña temporal guardada. Entrégasela en persona: deberá cambiarla al ingresar." };
}

export async function reiniciarSegundoFactorAccion(_previo: EstadoUsuario, f: FormData): Promise<EstadoUsuario> {
  const admin = await requerirAdmin();
  try {
    await reiniciarSegundoFactor(db(), { userId: texto(f, "userId"), motivo: texto(f, "motivo") }, { userId: admin.userId });
  } catch (error) {
    return traducir(error);
  }
  revalidatePath("/admin/usuarios");
  return { ok: "Segundo factor reiniciado. Deberá activarlo de nuevo al ingresar." };
}
