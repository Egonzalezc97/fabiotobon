import { registrar } from "@/modules/auditoria";
import type { BaseDeDatos } from "../db";
import type { Auth } from "./index";
import type { Rol } from "./usuarios";

export type UsuarioAutenticado = { userId: string; nombre: string; usuario: string | null; rol: Rol };
/** Compatibilidad: los módulos llaman "admin" a quien actúa en el panel, sea admin o asistente. */
export type AdminAutenticado = UsuarioAutenticado;

export type EstadoAcceso =
  | { tipo: "sin_sesion" }
  | { tipo: "sin_permiso"; userId: string }
  | { tipo: "debe_cambiar_contrasena"; userId: string }
  | { tipo: "sin_segundo_factor"; userId: string }
  | { tipo: "autorizado"; usuario: UsuarioAutenticado };

/**
 * Decide, en el servidor, si una petición puede entrar al panel. Exige, en orden:
 * sesión válida, cuenta activa en `usuario`, contraseña definitiva (no temporal) y segundo factor activado.
 * El rol se verifica después, en cada página y acción (requerirRol).
 */
export async function evaluarAcceso(auth: Auth, db: BaseDeDatos, headers: Headers): Promise<EstadoAcceso> {
  const sesion = await auth.api.getSession({ headers });
  if (!sesion) return { tipo: "sin_sesion" };

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
  if (!sesion.user.twoFactorEnabled) return { tipo: "sin_segundo_factor", userId: sesion.user.id };

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
