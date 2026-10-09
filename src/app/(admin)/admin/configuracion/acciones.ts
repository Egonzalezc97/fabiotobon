"use server";

import { revalidatePath } from "next/cache";
import { requerirAdmin } from "@/lib/auth/servidor";
import { db } from "@/lib/db";
import { registrar } from "@/modules/auditoria";
import {
  AutorizacionInvalida,
  ConfiguracionInvalida,
  ContactoInvalido,
  guardarAutorizacion,
  guardarContacto,
  guardarParametros,
  guardarPolitica,
  PoliticaInvalida,
} from "@/modules/configuracion";

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

export async function guardarContactoAccion(_previo: EstadoConfiguracion, f: FormData): Promise<EstadoConfiguracion> {
  const admin = await requerirAdmin();
  const campo = (clave: string) => String(f.get(clave) ?? "");
  try {
    await guardarContacto(
      db(),
      {
        especialidad: campo("especialidad"),
        direccion: campo("direccion"),
        ciudad: campo("ciudad"),
        referencia: campo("referencia"),
        telefono: campo("telefono"),
        whatsapp: campo("whatsapp"),
        mensajeWhatsapp: campo("mensajeWhatsapp"),
        correo: campo("correo"),
        registroProfesional: campo("registroProfesional"),
        instagram: campo("instagram"),
        facebook: campo("facebook"),
        urgenciasActiva: f.get("urgenciasActiva") === "si",
        urgenciasTexto: campo("urgenciasTexto"),
        urgenciasTelefono: campo("urgenciasTelefono"),
      },
      admin.userId,
    );
  } catch (error) {
    if (error instanceof ContactoInvalido) return { error: error.message };
    throw error;
  }
  revalidatePath("/", "layout");
  return { ok: "Datos de contacto guardados. Ya se ven en el sitio." };
}

export async function guardarAutorizacionAccion(_previo: EstadoConfiguracion, f: FormData): Promise<EstadoConfiguracion> {
  const admin = await requerirAdmin();
  try {
    const r = await guardarAutorizacion(
      db(),
      { texto: String(f.get("texto") ?? ""), borrador: f.get("borrador") === "si" },
      { id: admin.userId, tipo: "usuario" },
    );
    revalidatePath("/admin/configuracion");
    revalidatePath("/reservar", "layout");
    return { ok: r.creada ? `Versión ${r.version} guardada. Es la vigente.` : `Sin cambios: la versión vigente sigue siendo ${r.version}.` };
  } catch (error) {
    if (error instanceof AutorizacionInvalida) return { error: error.message };
    throw error;
  }
}

export async function guardarPoliticaAccion(_previo: EstadoConfiguracion, f: FormData): Promise<EstadoConfiguracion> {
  const admin = await requerirAdmin();
  try {
    const estado = await guardarPolitica(db(), String(f.get("texto") ?? ""), { id: admin.userId, tipo: "usuario" });
    revalidatePath("/", "layout");
    if (!estado.texto) return { ok: "Política borrada. El sitio no la enlaza." };
    return {
      ok: estado.publicable
        ? "Política guardada y publicada en /tratamiento-de-datos."
        : `Política guardada, sin publicar. Falta: ${estado.faltantes.join("; ")}.`,
    };
  } catch (error) {
    if (error instanceof PoliticaInvalida) return { error: error.message };
    throw error;
  }
}
