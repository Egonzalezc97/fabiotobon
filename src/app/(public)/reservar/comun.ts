import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { esProduccion } from "@/lib/despliegue";
import { env } from "@/lib/env";
import { datosPeticion } from "@/lib/peticion";
import { obtenerEmisor } from "@/lib/verificacion";
import type { Contexto } from "@/modules/agenda/reserva-publica";

// Utilidades de la reserva pública compartidas por páginas y acciones (sin reglas de negocio).

const COOKIE = "reserva";

export function entornoReserva() {
  return { emisor: obtenerEmisor(), produccion: esProduccion(process.env) };
}

export async function contextoReserva(): Promise<Contexto> {
  const { ip, userAgent } = await datosPeticion();
  return { ip, userAgent, ahora: new Date(), secreto: env().VERIFICACION_SECRET };
}

export async function leerTokenReserva(): Promise<string | undefined> {
  return (await cookies()).get(COOKIE)?.value;
}

export async function guardarTokenReserva(token: string): Promise<void> {
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/reservar",
    maxAge: 60 * 60 * 24,
  });
}

export { db };
