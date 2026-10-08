"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requerirAdmin } from "@/lib/auth/servidor";
import { db } from "@/lib/db";
import { guardarServicio, ServicioInvalido } from "@/modules/servicios";

export type EstadoServicio = { error?: string; ok?: string };

const texto = (f: FormData, clave: string) => String(f.get(clave) ?? "").trim();
const entero = (valor: string) => (/^\d+$/.test(valor) ? Number(valor) : Number.NaN);

export async function guardarServicioAccion(_previo: EstadoServicio, f: FormData): Promise<EstadoServicio> {
  const admin = await requerirAdmin();
  const id = texto(f, "id") || undefined;
  const precio = texto(f, "precio").replace(/[.\s$]/g, "");
  let guardado: { id: string };
  try {
    guardado = await guardarServicio(
      db(),
      {
        nombre: texto(f, "nombre"),
        descripcion: texto(f, "descripcion"),
        duracionMin: entero(texto(f, "duracion")),
        precioCop: precio === "" ? null : entero(precio),
        mostrarPrecio: f.get("mostrarPrecio") === "si",
        visibleEnLanding: f.get("visibleEnLanding") === "si",
        politicaReserva: texto(f, "politicaReserva"),
        orden: entero(texto(f, "orden") || "0"),
        activo: f.get("activo") === "si",
      },
      { id, actorId: admin.userId },
    );
  } catch (error) {
    if (error instanceof ServicioInvalido) return { error: error.message };
    throw error;
  }
  revalidatePath("/", "layout");
  if (!id) redirect(`/admin/servicios/${guardado.id}`);
  return { ok: "Servicio guardado." };
}
