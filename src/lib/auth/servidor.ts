import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { registrar } from "@/modules/auditoria";
import { db } from "../db";
import { evaluarAcceso, rolPermitido, type EstadoAcceso, type UsuarioAutenticado } from "./acceso";
import { auth } from "./index";
import type { Rol } from "./usuarios";

export async function estadoAccesoActual(): Promise<EstadoAcceso> {
  // headers() primero: marca la ruta como dinámica antes de tocar la base o los secretos.
  const encabezados = await headers();
  return evaluarAcceso(auth(), db(), encabezados);
}

/**
 * Para páginas, layouts, acciones y rutas del panel: devuelve el usuario si tiene uno de los roles, o redirige.
 * Un rol insuficiente queda en auditoría y vuelve al inicio del panel.
 */
export async function requerirRol(...roles: Rol[]): Promise<UsuarioAutenticado> {
  const estado = await estadoAccesoActual();
  switch (estado.tipo) {
    case "autorizado":
      if (rolPermitido(estado.usuario.rol, roles)) return estado.usuario;
      await registrar(db(), { actorId: estado.usuario.userId, actorTipo: "usuario", accion: "panel.rol_insuficiente", detalle: { rol: estado.usuario.rol } });
      redirect("/admin?aviso=sin-permiso");
    case "debe_cambiar_contrasena":
      redirect("/ingresar/cambiar-contrasena");
    case "sin_segundo_factor":
      redirect("/ingresar/segundo-factor");
    case "sin_sesion":
    case "sin_permiso":
      redirect("/ingresar");
  }
}

/** Solo administradores: usuarios, configuración, servicios, horario, galería y fusión de fichas. */
export function requerirAdmin(): Promise<UsuarioAutenticado> {
  return requerirRol("admin");
}

/** Administradores y asistentes: inicio, agenda, citas, bloqueos, pacientes, tratamientos y abonos. */
export function requerirPanel(): Promise<UsuarioAutenticado> {
  return requerirRol("admin", "asistente");
}
