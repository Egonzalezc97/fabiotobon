"use server";

import { revalidatePath } from "next/cache";
import { requerirAdmin } from "@/lib/auth/servidor";
import { db } from "@/lib/db";
import { registrar } from "@/modules/auditoria";
import { ConfiguracionInvalida, guardarParametros } from "@/modules/configuracion";

export type EstadoConfiguracion = { error?: string; ok?: string };

const entero = (f: FormData, clave: string) => {
  const v = String(f.get(clave) ?? "").trim();
  return /^\d+$/.test(v) ? Number(v) : Number.NaN;
};

export async function guardarConfiguracionAccion(_previo: EstadoConfiguracion, f: FormData): Promise<EstadoConfiguracion> {
  const admin = await requerirAdmin();
  try {
    await guardarParametros(db(), {
      granularidadMin: entero(f, "granularidadMin"),
      antelacionMin: entero(f, "antelacionHoras") * 60,
      horizonteDias: entero(f, "horizonteDias"),
      estadoInicialCitaWeb: String(f.get("estadoInicialCitaWeb")) === "pendiente" ? "pendiente" : "confirmada",
      documentoObligatorio: f.get("documentoObligatorio") === "si",
      maxValoracionesFuturas: entero(f, "maxValoracionesFuturas"),
    });
  } catch (error) {
    if (error instanceof ConfiguracionInvalida) return { error: "Revisa los valores: alguno está fuera del rango permitido." };
    throw error;
  }
  await registrar(db(), { actorId: admin.userId, actorTipo: "usuario", accion: "configuracion.actualizada" });
  revalidatePath("/", "layout");
  return { ok: "Configuración guardada." };
}
