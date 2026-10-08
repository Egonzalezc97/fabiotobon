import { cp, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { sql } from "kysely";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { cerrarDb, db, pool } from "@/lib/db";
import { CARPETA_MIGRACIONES, migrar } from "@/lib/db/migraciones";
import { limpiarDatos } from "./ayudas";

afterAll(cerrarDb);
beforeEach(() => limpiarDatos(db()));

describe("migraciones", () => {
  it("son idempotentes: una segunda corrida no aplica nada", async () => {
    const resultado = await migrar(pool());
    expect(resultado.aplicadas).toEqual([]);
    expect(resultado.yaAplicadas).toEqual(["0001_base.sql", "0002_horario_laboral.sql"]);
  });

  it("rechazan una migración aplicada que fue editada", async () => {
    const carpeta = await mkdtemp(path.join(tmpdir(), "migraciones-"));
    try {
      await cp(CARPETA_MIGRACIONES, carpeta, { recursive: true });
      await writeFile(path.join(carpeta, "0001_base.sql"), "-- editada\n", { flag: "a" });
      await expect(migrar(pool(), carpeta)).rejects.toThrow(/0001_base\.sql cambió/);
    } finally {
      await rm(carpeta, { recursive: true, force: true });
    }
  });

  it("no consideran cambio la diferencia entre saltos de línea CRLF y LF", async () => {
    const carpeta = await mkdtemp(path.join(tmpdir(), "migraciones-"));
    try {
      await cp(CARPETA_MIGRACIONES, carpeta, { recursive: true });
      const archivo = path.join(carpeta, "0002_horario_laboral.sql");
      const { readFile } = await import("node:fs/promises");
      const original = (await readFile(archivo, "utf8")).replace(/\r\n/g, "\n");
      await writeFile(archivo, original.replace(/\n/g, "\r\n"));
      await expect(migrar(pool(), carpeta)).resolves.toMatchObject({ aplicadas: [] });
    } finally {
      await rm(carpeta, { recursive: true, force: true });
    }
  });

  it("rechazan una base con migraciones que no están en el repositorio", async () => {
    const carpeta = await mkdtemp(path.join(tmpdir(), "migraciones-"));
    try {
      await cp(path.join(CARPETA_MIGRACIONES, "0001_base.sql"), path.join(carpeta, "0001_base.sql"));
      await expect(migrar(pool(), carpeta)).rejects.toThrow(/no existen en el repositorio/);
    } finally {
      await rm(carpeta, { recursive: true, force: true });
    }
  });
});

describe("auditoria", () => {
  it("admite inserciones pero no modificaciones ni borrados", async () => {
    await db().insertInto("auditoria").values({ actor_tipo: "sistema", accion: "prueba.creada" }).execute();
    await expect(db().updateTable("auditoria").set({ accion: "prueba.editada" }).execute()).rejects.toThrow(
      /solo inserción/,
    );
    await expect(db().deleteFrom("auditoria").execute()).rejects.toThrow(/solo inserción/);
    await expect(sql`TRUNCATE auditoria`.execute(db())).rejects.toThrow(/solo inserción/);
  });
});

describe("servicio", () => {
  const base = { slug: "valoracion", nombre: "Valoración", duracion_min: 30 };

  it("no permite mostrar precio si no hay precio", async () => {
    await expect(
      db().insertInto("servicio").values({ ...base, mostrar_precio: true, precio_cop: null }).execute(),
    ).rejects.toThrow(/servicio_precio_visible_requiere_precio/);
  });

  it("rechaza duraciones no positivas y políticas desconocidas", async () => {
    await expect(db().insertInto("servicio").values({ ...base, duracion_min: 0 }).execute()).rejects.toThrow();
    await expect(
      db().insertInto("servicio").values({ ...base, politica_reserva: "cualquiera" }).execute(),
    ).rejects.toThrow();
  });

  it("nace con la política de reserva más restrictiva", async () => {
    const fila = await db().insertInto("servicio").values(base).returning("politica_reserva").executeTakeFirstOrThrow();
    expect(fila.politica_reserva).toBe("solo_admin");
  });
});

describe("horario_laboral", () => {
  it("admite varios tramos por día pero no tramos superpuestos", async () => {
    await db()
      .insertInto("horario_laboral")
      .values([
        { dia_semana: 1, hora_inicio: "08:00", hora_fin: "12:00" },
        { dia_semana: 1, hora_inicio: "14:00", hora_fin: "18:00" },
        { dia_semana: 2, hora_inicio: "08:00", hora_fin: "12:00" },
      ])
      .execute();
    await expect(
      db().insertInto("horario_laboral").values({ dia_semana: 1, hora_inicio: "11:00", hora_fin: "15:00" }).execute(),
    ).rejects.toThrow(/horario_laboral_sin_solapes/);
  });

  it("admite tramos contiguos (12:00 termina uno y empieza otro)", async () => {
    await db()
      .insertInto("horario_laboral")
      .values([
        { dia_semana: 3, hora_inicio: "08:00", hora_fin: "12:00" },
        { dia_semana: 3, hora_inicio: "12:00", hora_fin: "13:00" },
      ])
      .execute();
  });

  it("rechaza tramos invertidos y días fuera de 1–7", async () => {
    await expect(
      db().insertInto("horario_laboral").values({ dia_semana: 1, hora_inicio: "12:00", hora_fin: "08:00" }).execute(),
    ).rejects.toThrow(/horario_laboral_rango_valido/);
    await expect(
      db().insertInto("horario_laboral").values({ dia_semana: 8, hora_inicio: "08:00", hora_fin: "12:00" }).execute(),
    ).rejects.toThrow();
  });
});
