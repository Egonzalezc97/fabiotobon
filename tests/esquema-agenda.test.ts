import { sql } from "kysely";
import { Pool } from "pg";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { cerrarDb, db } from "@/lib/db";
import { limpiarDatos } from "./ayudas";

afterAll(cerrarDb);
beforeEach(() => limpiarDatos(db()));

async function base() {
  const servicio = await db()
    .insertInto("servicio")
    .values({ slug: "valoracion", nombre: "Valoración", duracion_min: 30 })
    .returning("id")
    .executeTakeFirstOrThrow();
  const paciente = await db()
    .insertInto("paciente")
    .values({ tipo_documento: "CC", numero_documento: "1020304050", nombre: "Paciente de prueba", celular: "+573001112233" })
    .returning("id")
    .executeTakeFirstOrThrow();
  return { servicioId: servicio.id, pacienteId: paciente.id };
}

function cita(ids: { servicioId: string; pacienteId: string }, inicio: string, fin: string, estado = "confirmada") {
  return { paciente_id: ids.pacienteId, servicio_id: ids.servicioId, inicio, fin, estado, origen: "panel" };
}

describe("paciente", () => {
  it("identifica por tipo y número de documento; el celular puede repetirse", async () => {
    const celular = "+573001112233";
    await db()
      .insertInto("paciente")
      .values([
        { tipo_documento: "CC", numero_documento: "52123456", nombre: "Madre", celular },
        { tipo_documento: "TI", numero_documento: "1012345678", nombre: "Hijo", celular },
        // Mismo número con otro tipo de documento: es otra persona.
        { tipo_documento: "CE", numero_documento: "52123456", nombre: "Otra persona", celular },
      ])
      .execute();
    await expect(
      db().insertInto("paciente").values({ tipo_documento: "CC", numero_documento: "52123456", nombre: "Duplicado" }).execute(),
    ).rejects.toThrow(/paciente_documento_unico/);
  });

  it("valida el formato básico del documento según su tipo", async () => {
    const intentar = (tipo_documento: string, numero_documento: string) =>
      db().insertInto("paciente").values({ tipo_documento, numero_documento, nombre: "X" }).execute();
    await expect(intentar("CC", "12.345.678")).rejects.toThrow(/paciente_documento_formato/);
    await expect(intentar("TI", "12345")).rejects.toThrow(/paciente_documento_formato/);
    await expect(intentar("XX", "12345678")).rejects.toThrow();
    await expect(intentar("PA", "AB123456")).resolves.toBeDefined();
  });

  it("exige tipo y número juntos, y celular en E.164", async () => {
    await expect(
      db().insertInto("paciente").values({ tipo_documento: "CC", numero_documento: null, nombre: "X" }).execute(),
    ).rejects.toThrow(/paciente_documento_completo/);
    await expect(db().insertInto("paciente").values({ nombre: "X", celular: "3001112233" }).execute()).rejects.toThrow();
  });
});

describe("cita: no-solapamiento garantizado por PostgreSQL", () => {
  it("rechaza un INSERT directo que se cruza con una cita activa", async () => {
    const ids = await base();
    await db().insertInto("cita").values(cita(ids, "2026-11-02T13:00:00Z", "2026-11-02T13:30:00Z")).execute();
    await expect(
      db().insertInto("cita").values(cita(ids, "2026-11-02T13:15:00Z", "2026-11-02T13:45:00Z", "pendiente")).execute(),
    ).rejects.toThrow(/cita_sin_solapes/);
  });

  it("permite citas contiguas y cruces con citas canceladas", async () => {
    const ids = await base();
    await db().insertInto("cita").values(cita(ids, "2026-11-02T13:00:00Z", "2026-11-02T13:30:00Z")).execute();
    await db().insertInto("cita").values(cita(ids, "2026-11-02T13:30:00Z", "2026-11-02T14:00:00Z")).execute();
    await db().insertInto("cita").values(cita(ids, "2026-11-02T13:00:00Z", "2026-11-02T14:00:00Z", "cancelada")).execute();
  });

  it("reactivar una cita cancelada sobre un horario ocupado también se rechaza", async () => {
    const ids = await base();
    const cancelada = await db()
      .insertInto("cita")
      .values(cita(ids, "2026-11-02T13:00:00Z", "2026-11-02T13:30:00Z", "cancelada"))
      .returning("id")
      .executeTakeFirstOrThrow();
    await db().insertInto("cita").values(cita(ids, "2026-11-02T13:00:00Z", "2026-11-02T13:30:00Z")).execute();
    await expect(
      db().updateTable("cita").set({ estado: "confirmada" }).where("id", "=", cancelada.id).execute(),
    ).rejects.toThrow(/cita_sin_solapes/);
  });

  it("con dos inserciones simultáneas del mismo horario desde conexiones distintas, exactamente una gana", async () => {
    const ids = await base();
    const conexiones = new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
    try {
      const intentos = await Promise.allSettled(
        Array.from({ length: 8 }, () =>
          conexiones.query(
            `INSERT INTO cita (paciente_id, servicio_id, inicio, fin, estado, origen)
             VALUES ($1, $2, '2026-11-03T14:00:00Z', '2026-11-03T14:30:00Z', 'confirmada', 'web')`,
            [ids.pacienteId, ids.servicioId],
          ),
        ),
      );
      expect(intentos.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      const rechazos = intentos.filter((r): r is PromiseRejectedResult => r.status === "rejected");
      expect(rechazos.every((r) => (r.reason as { code?: string }).code === "23P01")).toBe(true);
    } finally {
      await conexiones.end();
    }
  });
});

describe("historiales de solo inserción", () => {
  it("cita_evento y consentimiento no se pueden editar ni borrar", async () => {
    const ids = await base();
    const { id } = await db()
      .insertInto("cita")
      .values(cita(ids, "2026-11-02T13:00:00Z", "2026-11-02T13:30:00Z"))
      .returning("id")
      .executeTakeFirstOrThrow();
    await db().insertInto("cita_evento").values({ cita_id: id, tipo: "creada", actor_tipo: "sistema" }).execute();
    await expect(db().updateTable("cita_evento").set({ tipo: "cancelada" }).execute()).rejects.toThrow(/solo inserción/);
    await expect(db().deleteFrom("cita_evento").execute()).rejects.toThrow(/solo inserción/);

    await db()
      .insertInto("consentimiento")
      .values({
        paciente_id: ids.pacienteId,
        tipo: "tratamiento_datos",
        version: "v1",
        texto: "Texto",
        texto_sha256: "a".repeat(64),
        origen: "web",
      })
      .execute();
    await expect(db().deleteFrom("consentimiento").execute()).rejects.toThrow(/solo inserción/);
  });

  it("las citas no se pueden borrar mientras tengan historial", async () => {
    const ids = await base();
    const { id } = await db()
      .insertInto("cita")
      .values(cita(ids, "2026-11-02T13:00:00Z", "2026-11-02T13:30:00Z"))
      .returning("id")
      .executeTakeFirstOrThrow();
    await db().insertInto("cita_evento").values({ cita_id: id, tipo: "creada", actor_tipo: "sistema" }).execute();
    await expect(sql`DELETE FROM cita WHERE id = ${id}`.execute(db())).rejects.toThrow();
  });
});

describe("parámetros por defecto (DPF)", () => {
  it("la migración deja los valores acordados", async () => {
    const filas = await db().selectFrom("configuracion").select(["clave", "valor"]).execute();
    const valores = Object.fromEntries(filas.map((f) => [f.clave, f.valor]));
    expect(valores).toMatchObject({
      agenda_granularidad_min: 15,
      agenda_antelacion_min: 120,
      agenda_horizonte_dias: 30,
      cita_web_estado_inicial: "confirmada",
      reserva_documento_obligatorio: true,
      reserva_max_valoraciones_futuras: 1,
    });
  });
});
