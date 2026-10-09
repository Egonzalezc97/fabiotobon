"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requerirPanel } from "@/lib/auth/servidor";
import { db } from "@/lib/db";
import {
  ajustarCosto,
  anularAbono,
  cambiarEstadoTratamiento,
  cancelarTratamiento,
  crearTratamiento,
  ErrorTratamiento,
  registrarAbono,
  SaldoAFavorSinConfirmar,
  type EstadoTratamiento,
  type MedioAbono,
} from "@/modules/tratamientos";

// Tratamientos y abonos: admin y asistente. Cada acción exige sesión y rol antes de todo.

export type EstadoTrat = { error?: string; ok?: string; excedente?: number };

const texto = (f: FormData, clave: string) => String(f.get(clave) ?? "").trim();
/** "1.200.000" o "$ 1 200 000" → 1200000. Vacío o inválido → NaN (lo rechaza el módulo). */
const pesos = (f: FormData, clave: string) => {
  const limpio = texto(f, clave).replace(/[$\s.]/g, "");
  return /^\d+$/.test(limpio) ? Number(limpio) : Number.NaN;
};
const confirma = (f: FormData) => f.get("confirmaSaldoAFavor") === "si";

function traducir(error: unknown): EstadoTrat {
  if (error instanceof SaldoAFavorSinConfirmar) return { error: error.message, excedente: error.excedente };
  if (error instanceof ErrorTratamiento) return { error: error.message };
  throw error;
}

function refrescar(f: FormData) {
  revalidatePath(`/admin/tratamientos/${texto(f, "tratamientoId")}`);
  revalidatePath("/admin", "layout");
}

export async function crearTratamientoAccion(_previo: EstadoTrat, f: FormData): Promise<EstadoTrat> {
  const usuario = await requerirPanel();
  let id: string;
  try {
    ({ id } = await crearTratamiento(
      db(),
      {
        pacienteId: texto(f, "pacienteId"),
        servicioId: texto(f, "servicioId") || null,
        descripcion: texto(f, "descripcion"),
        costoTotal: pesos(f, "costoTotal"),
        estado: texto(f, "estado") === "en_curso" ? "en_curso" : "presupuestado",
        notas: texto(f, "notas"),
      },
      { userId: usuario.userId },
    ));
  } catch (error) {
    return traducir(error);
  }
  redirect(`/admin/tratamientos/${id}`);
}

export async function ajustarCostoAccion(_previo: EstadoTrat, f: FormData): Promise<EstadoTrat> {
  const usuario = await requerirPanel();
  try {
    await ajustarCosto(
      db(),
      texto(f, "tratamientoId"),
      { costoTotal: pesos(f, "costoTotal"), motivo: texto(f, "motivo"), confirmaSaldoAFavor: confirma(f) },
      { userId: usuario.userId },
    );
  } catch (error) {
    return traducir(error);
  }
  refrescar(f);
  return { ok: "Costo ajustado." };
}

const ESTADOS: EstadoTratamiento[] = ["presupuestado", "en_curso", "terminado"];

export async function cambiarEstadoTratamientoAccion(_previo: EstadoTrat, f: FormData): Promise<EstadoTrat> {
  const usuario = await requerirPanel();
  const estado = texto(f, "estado") as EstadoTratamiento;
  if (!ESTADOS.includes(estado)) return { error: "Estado no válido." };
  try {
    await cambiarEstadoTratamiento(db(), texto(f, "tratamientoId"), estado, { userId: usuario.userId });
  } catch (error) {
    return traducir(error);
  }
  refrescar(f);
  return { ok: "Estado actualizado." };
}

export async function cancelarTratamientoAccion(_previo: EstadoTrat, f: FormData): Promise<EstadoTrat> {
  const usuario = await requerirPanel();
  const valor = texto(f, "valorRealizado") === "" ? null : pesos(f, "valorRealizado");
  try {
    await cancelarTratamiento(
      db(),
      texto(f, "tratamientoId"),
      { valorRealizado: valor, motivo: texto(f, "motivo"), confirmaSaldoAFavor: confirma(f) },
      { userId: usuario.userId },
    );
  } catch (error) {
    return traducir(error);
  }
  refrescar(f);
  return { ok: "Tratamiento cancelado." };
}

const MEDIOS: MedioAbono[] = ["efectivo", "transferencia", "tarjeta", "otro"];

export async function registrarAbonoAccion(_previo: EstadoTrat, f: FormData): Promise<EstadoTrat> {
  const usuario = await requerirPanel();
  const medio = texto(f, "medio") as MedioAbono;
  if (!MEDIOS.includes(medio)) return { error: "Elige el medio de pago." };
  try {
    await registrarAbono(
      db(),
      {
        tratamientoId: texto(f, "tratamientoId"),
        valor: pesos(f, "valor"),
        fecha: texto(f, "fecha"),
        medio,
        referencia: texto(f, "referencia"),
        confirmaSaldoAFavor: confirma(f),
      },
      { userId: usuario.userId },
    );
  } catch (error) {
    return traducir(error);
  }
  refrescar(f);
  return { ok: "Abono registrado." };
}

export async function anularAbonoAccion(_previo: EstadoTrat, f: FormData): Promise<EstadoTrat> {
  const usuario = await requerirPanel();
  try {
    await anularAbono(db(), texto(f, "abonoId"), texto(f, "motivo"), { userId: usuario.userId });
  } catch (error) {
    return traducir(error);
  }
  refrescar(f);
  return { ok: "Abono anulado." };
}
