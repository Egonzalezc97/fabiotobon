import { registrar } from "@/modules/auditoria";
import type { BaseDeDatos } from "../db";
import { SESION, type Auth } from "./index";
import type { Rol } from "./usuarios";

export type UsuarioAutenticado = { userId: string; nombre: string; usuario: string | null; rol: Rol };
/** Compatibilidad: los módulos llaman "admin" a quien actúa en el panel, sea admin o asistente. */
export type AdminAutenticado = UsuarioAutenticado;

export type EstadoAcceso =
  | { tipo: "sin_sesion" }
  | { tipo: "sin_permiso"; userId: string }
  | { tipo: "debe_cambiar_contrasena"; userId: string }
  | { tipo: "autorizado"; usuario: UsuarioAutenticado };

/**
 * Decide, en el servidor, si una petición puede entrar al panel. Exige, en orden:
 * sesión válida (y de menos de 12 horas), cuenta activa en `usuario` y contraseña definitiva (no temporal).
 * El segundo factor es opcional (decisión del 2026-10-08): si la cuenta lo activó, Better Auth ya pidió el código al ingresar.
 * El rol se verifica después, en cada página y acción (requerirRol).
 */
export async function evaluarAcceso(auth: Auth, db: BaseDeDatos, headers: Headers, ahora = new Date()): Promise<EstadoAcceso> {
  const sesion = await auth.api.getSession({ headers });
  if (!sesion) return { tipo: "sin_sesion" };

  // Tope absoluto: aunque haya actividad, una sesión no dura más de 12 horas.
  if (ahora.getTime() - new Date(sesion.session.createdAt).getTime() > SESION.topeHoras * 60 * 60_000) {
    await db.deleteFrom("session").where("id", "=", sesion.session.id).execute();
    await registrar(db, { actorId: sesion.user.id, actorTipo: "usuario", accion: "sesion.tope_alcanzado" });
    return { tipo: "sin_sesion" };
  }

  const usuario = await db
    .selectFrom("usuario")
    .select(["rol", "debe_cambiar_contrasena"])
    .where("user_id", "=", sesion.user.id)
    .where("activo", "=", true)
    .executeTakeFirst();

  if (!usuario || (usuario.rol !== "admin" && usuario.rol !== "asistente")) {
    await registrar(db, { actorId: sesion.user.id, actorTipo: "usuario", accion: "panel.acceso_denegado" });
    return { tipo: "sin_permiso", userId: sesion.user.id };
  }
  if (usuario.debe_cambiar_contrasena) return { tipo: "debe_cambiar_contrasena", userId: sesion.user.id };

  const nombreUsuario = (sesion.user as { username?: string | null }).username ?? null;
  return {
    tipo: "autorizado",
    usuario: { userId: sesion.user.id, nombre: sesion.user.name, usuario: nombreUsuario, rol: usuario.rol },
  };
}

/** ¿El rol alcanza? Separado para probarlo sin servidor. */
export function rolPermitido(rol: Rol, permitidos: readonly Rol[]): boolean {
  return permitidos.includes(rol);
}
