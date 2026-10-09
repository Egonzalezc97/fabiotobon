import { sql } from "kysely";
import { registrar } from "@/modules/auditoria";
import type { BaseDeDatos } from "../db";

/**
 * Bloqueo de ingreso por nombre de usuario. Con el 2FA opcional, la contraseña es la única barrera obligatoria.
 * Se cuenta por el nombre ESCRITO, exista o no la cuenta, y la respuesta al bloqueo es la misma en ambos casos.
 */
export const LIMITES_INGRESO = { maxFallidos: 5, ventanaMin: 15, bloqueoMin: 15 } as const;

const minutos = (n: number) => n * 60_000;

export function normalizarIntento(usuario: unknown): string | null {
  if (typeof usuario !== "string") return null;
  const limpio = usuario.trim().toLowerCase().slice(0, 128);
  return limpio || null;
}

/** Hasta cuándo está bloqueado ese nombre de usuario, o null. */
export async function bloqueadoHasta(db: BaseDeDatos, usuario: string, ahora = new Date()): Promise<Date | null> {
  const fila = await db
    .selectFrom("intento_ingreso")
    .select("bloqueado_hasta")
    .where("usuario", "=", usuario)
    .where("bloqueado_hasta", ">", ahora)
    .executeTakeFirst();
  return fila?.bloqueado_hasta ?? null;
}

/**
 * Suma un fallo (atómico). Al llegar al máximo dentro de la ventana, bloquea y reinicia el contador.
 * Devuelve el fin del bloqueo si este fallo lo provocó.
 */
export async function registrarFallo(db: BaseDeDatos, usuario: string, ahora = new Date()): Promise<Date | null> {
  const inicioVentana = new Date(ahora.getTime() - minutos(LIMITES_INGRESO.ventanaMin));
  const { fallidos } = await db
    .insertInto("intento_ingreso")
    .values({ usuario, fallidos: 1, ultimo_fallo: ahora })
    .onConflict((oc) =>
      oc.column("usuario").doUpdateSet({
        fallidos: sql<number>`CASE WHEN intento_ingreso.ultimo_fallo < ${inicioVentana} THEN 1 ELSE intento_ingreso.fallidos + 1 END`,
        ultimo_fallo: ahora,
      }),
    )
    .returning("fallidos")
    .executeTakeFirstOrThrow();
  // Limpieza: nombres sin fallos recientes ni bloqueo vigente (evita que la tabla crezca con nombres inventados).
  await db
    .deleteFrom("intento_ingreso")
    .where("ultimo_fallo", "<", new Date(ahora.getTime() - minutos(24 * 60)))
    .where((eb) => eb.or([eb("bloqueado_hasta", "is", null), eb("bloqueado_hasta", "<", ahora)]))
    .execute();
  if (fallidos < LIMITES_INGRESO.maxFallidos) return null;
  const hasta = new Date(ahora.getTime() + minutos(LIMITES_INGRESO.bloqueoMin));
  await db.updateTable("intento_ingreso").set({ bloqueado_hasta: hasta, fallidos: 0 }).where("usuario", "=", usuario).execute();
  return hasta;
}

/** Ingreso correcto: el contador vuelve a cero. */
export async function limpiarIntentos(db: BaseDeDatos, usuario: string): Promise<void> {
  await db.deleteFrom("intento_ingreso").where("usuario", "=", usuario).execute();
}

/** Desbloqueo manual desde Panel → Usuarios (solo admin; lo verifica la acción). Queda en auditoría. */
export async function desbloquearIngreso(db: BaseDeDatos, userId: string, actor: { userId: string }): Promise<boolean> {
  return db.transaction().execute(async (trx) => {
    const cuenta = await trx.selectFrom("user").select("username").where("id", "=", userId).executeTakeFirst();
    const usuario = normalizarIntento(cuenta?.username);
    if (!usuario) return false;
    const borrada = await trx.deleteFrom("intento_ingreso").where("usuario", "=", usuario).returning("usuario").executeTakeFirst();
    await registrar(trx, {
      actorId: actor.userId,
      actorTipo: "usuario",
      accion: "usuario.desbloqueado",
      entidad: "usuario",
      entidadId: userId,
      detalle: { estaba_bloqueado: Boolean(borrada) },
    });
    return Boolean(borrada);
  });
}
