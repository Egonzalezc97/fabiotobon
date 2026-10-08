import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "../db";
import { evaluarAcceso, type AdminAutenticado, type EstadoAcceso } from "./acceso";
import { auth } from "./index";

export async function estadoAccesoActual(): Promise<EstadoAcceso> {
  // headers() primero: marca la ruta como dinámica antes de tocar la base o los secretos.
  const encabezados = await headers();
  return evaluarAcceso(auth(), db(), encabezados);
}

/** Para páginas, layouts y acciones del panel: devuelve el admin o redirige. */
export async function requerirAdmin(): Promise<AdminAutenticado> {
  const estado = await estadoAccesoActual();
  switch (estado.tipo) {
    case "admin":
      return estado.admin;
    case "sin_segundo_factor":
      redirect("/ingresar/segundo-factor");
    case "sin_sesion":
    case "sin_permiso":
      redirect("/ingresar");
  }
}
