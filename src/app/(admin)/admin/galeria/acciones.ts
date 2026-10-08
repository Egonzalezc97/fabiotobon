"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { almacenamiento } from "@/lib/almacenamiento";
import { requerirAdmin } from "@/lib/auth/servidor";
import { db } from "@/lib/db";
import { actualizarCaso, crearCaso, despublicarCaso, ErrorGaleria, publicarCaso } from "@/modules/galeria";

// Galería: solo administradores.

export type EstadoGaleria = { error?: string; ok?: string };

const texto = (f: FormData, clave: string) => String(f.get(clave) ?? "").trim();
const esUuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v);

function refrescar(id: string) {
  revalidatePath("/admin/galeria");
  revalidatePath(`/admin/galeria/${id}`);
  revalidatePath("/");
}

export async function guardarCasoAccion(_previo: EstadoGaleria, f: FormData): Promise<EstadoGaleria> {
  const admin = await requerirAdmin();
  const casoId = texto(f, "casoId");
  const datos = {
    procedimiento: texto(f, "procedimiento"),
    servicioId: esUuid(texto(f, "servicioId")) ? texto(f, "servicioId") : null,
    descripcion: texto(f, "descripcion"),
    imagenAntesId: texto(f, "imagenAntesId"),
    imagenDespuesId: texto(f, "imagenDespuesId"),
    consentimientoImagenId: esUuid(texto(f, "consentimientoImagenId")) ? texto(f, "consentimientoImagenId") : null,
    orden: Number(texto(f, "orden")) || 0,
  };
  if (datos.imagenAntesId && !esUuid(datos.imagenAntesId)) return { error: "Imagen de antes no válida." };
  if (datos.imagenDespuesId && !esUuid(datos.imagenDespuesId)) return { error: "Imagen de después no válida." };
  let id = casoId;
  try {
    if (casoId) {
      if (!esUuid(casoId)) return { error: "Caso no válido." };
      await actualizarCaso(db(), casoId, datos, { userId: admin.userId });
    } else {
      ({ id } = await crearCaso(db(), datos, { userId: admin.userId }));
    }
  } catch (error) {
    if (error instanceof ErrorGaleria) return { error: error.message };
    throw error;
  }
  refrescar(id);
  if (!casoId) redirect(`/admin/galeria/${id}`);
  return { ok: "Cambios guardados." };
}

export async function publicarAccion(_previo: EstadoGaleria, f: FormData): Promise<EstadoGaleria> {
  const admin = await requerirAdmin();
  const id = texto(f, "casoId");
  if (!esUuid(id)) return { error: "Caso no válido." };
  try {
    if (texto(f, "operacion") === "despublicar") await despublicarCaso(db(), almacenamiento(), id, { userId: admin.userId });
    else await publicarCaso(db(), almacenamiento(), id, { userId: admin.userId });
  } catch (error) {
    if (error instanceof ErrorGaleria) return { error: error.message };
    throw error;
  }
  refrescar(id);
  return { ok: texto(f, "operacion") === "despublicar" ? "Caso retirado del sitio. Sus versiones públicas se borraron." : "Caso publicado en el sitio." };
}
