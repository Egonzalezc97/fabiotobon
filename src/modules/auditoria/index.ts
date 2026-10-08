import type { BaseDeDatos } from "@/lib/db";

export type ActorTipo = "usuario" | "sistema" | "anonimo";

export type EventoAuditoria = {
  actorId?: string | null;
  actorTipo: ActorTipo;
  /** Verbo en minúsculas con punto: `sesion.iniciada`, `paciente.leido`. */
  accion: string;
  entidad?: string;
  entidadId?: string;
  /** Contexto adicional. Nunca contraseñas, códigos, tokens ni datos clínicos. */
  detalle?: Record<string, string | number | boolean | null>;
  ip?: string | null;
  userAgent?: string | null;
};

export async function registrar(db: BaseDeDatos, evento: EventoAuditoria): Promise<void> {
  await db
    .insertInto("auditoria")
    .values({
      actor_id: evento.actorId ?? null,
      actor_tipo: evento.actorTipo,
      accion: evento.accion,
      entidad: evento.entidad ?? null,
      entidad_id: evento.entidadId ?? null,
      detalle: JSON.stringify(evento.detalle ?? {}),
      ip: evento.ip ?? null,
      user_agent: evento.userAgent?.slice(0, 500) ?? null,
    })
    .execute();
}
