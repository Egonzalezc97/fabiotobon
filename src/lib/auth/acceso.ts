import { registrar } from "@/modules/auditoria";
import type { BaseDeDatos } from "../db";
import type { Auth } from "./index";

export type AdminAutenticado = { userId: string; correo: string; nombre: string; rol: "admin" };

export type EstadoAcceso =
  | { tipo: "sin_sesion" }
  | { tipo: "sin_permiso"; userId: string }
  | { tipo: "sin_segundo_factor"; userId: string }
  | { tipo: "admin"; admin: AdminAutenticado };

/**
 * Decide, en el servidor, si una petición puede entrar al panel.
 * Exige las tres cosas: sesión válida, fila activa en `usuario` y segundo factor activado.
 */
export async function evaluarAcceso(auth: Auth, db: BaseDeDatos, headers: Headers): Promise<EstadoAcceso> {
  const sesion = await auth.api.getSession({ headers });
  if (!sesion) return { tipo: "sin_sesion" };

  const usuario = await db
    .selectFrom("usuario")
    .select(["rol"])
    .where("user_id", "=", sesion.user.id)
    .where("activo", "=", true)
    .executeTakeFirst();

  if (!usuario || usuario.rol !== "admin") {
    await registrar(db, { actorId: sesion.user.id, actorTipo: "usuario", accion: "panel.acceso_denegado" });
    return { tipo: "sin_permiso", userId: sesion.user.id };
  }
  if (!sesion.user.twoFactorEnabled) return { tipo: "sin_segundo_factor", userId: sesion.user.id };

  return {
    tipo: "admin",
    admin: { userId: sesion.user.id, correo: sesion.user.email, nombre: sesion.user.name, rol: "admin" },
  };
}
