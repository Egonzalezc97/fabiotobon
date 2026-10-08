import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { cerrarDb, db } from "@/lib/db";
import { normalizarCelular } from "@/lib/telefono";
import {
  actualizarPaciente,
  buscarPacientes,
  crearPaciente,
  DatosPacienteInvalidos,
  DocumentoDuplicado,
  obtenerFicha,
} from "@/modules/pacientes";
import { formatearDocumento, normalizarDocumento } from "@/modules/pacientes/documento";
import { limpiarDatos } from "./ayudas";

afterAll(cerrarDb);
beforeEach(() => limpiarDatos(db()));

const FABIO = { userId: "usuario-fabio" };
const base = { tipoDocumento: "CC", numeroDocumento: "1.020.304.050", nombre: "José Pérez", celular: "300 111 2233" };

describe("documento y celular", () => {
  it("normaliza el documento y valida su formato según el tipo", () => {
    expect(normalizarDocumento("CC", " 1.020.304-050 ")).toEqual({ tipo: "CC", numero: "1020304050" });
    expect(normalizarDocumento("PA", "ab 12345")).toEqual({ tipo: "PA", numero: "AB12345" });
    expect(normalizarDocumento("TI", "12345")).toBeNull();
    expect(normalizarDocumento("CC", "12AB")).toBeNull();
    expect(normalizarDocumento("NIT", "900123456")).toBeNull();
    expect(formatearDocumento("CC", "1020304050")).toBe("CC 1.020.304.050");
  });

  it("normaliza celulares a E.164; en Colombia exige móvil", () => {
    expect(normalizarCelular("300 111 2233")).toBe("+573001112233");
    expect(normalizarCelular("+57 300-111-2233")).toBe("+573001112233");
    expect(normalizarCelular("6041234567")).toBeNull(); // fijo
    expect(normalizarCelular("+1 415 555 2671")).toBe("+14155552671");
    expect(normalizarCelular("123")).toBeNull();
  });
});

describe("pacientes desde el panel", () => {
  it("crea con documento obligatorio y celular sin verificar", async () => {
    const { id } = await crearPaciente(db(), base, FABIO);
    const fila = await db().selectFrom("paciente").selectAll().where("id", "=", id).executeTakeFirstOrThrow();
    expect(fila).toMatchObject({ numero_documento: "1020304050", celular: "+573001112233", celular_verificado_en: null });
    await expect(crearPaciente(db(), { ...base, numeroDocumento: "" }, FABIO)).rejects.toBeInstanceOf(DatosPacienteInvalidos);
  });

  it("no duplica documentos aunque se escriban distinto", async () => {
    await crearPaciente(db(), base, FABIO);
    await expect(crearPaciente(db(), { ...base, numeroDocumento: "1020304050", nombre: "Otro" }, FABIO)).rejects.toBeInstanceOf(
      DocumentoDuplicado,
    );
  });

  it("permite varios pacientes con el mismo celular", async () => {
    await crearPaciente(db(), base, FABIO);
    await expect(
      crearPaciente(db(), { ...base, tipoDocumento: "TI", numeroDocumento: "1012345678", nombre: "Hijo" }, FABIO),
    ).resolves.toBeDefined();
  });

  it("cambiar el celular borra su verificación", async () => {
    const { id } = await crearPaciente(db(), base, FABIO);
    await db().updateTable("paciente").set({ celular_verificado_en: new Date() }).where("id", "=", id).execute();
    await actualizarPaciente(db(), id, { ...base, estado: "activo" }, FABIO);
    expect((await db().selectFrom("paciente").select("celular_verificado_en").executeTakeFirstOrThrow()).celular_verificado_en).not.toBeNull();
    await actualizarPaciente(db(), id, { ...base, celular: "3009998877", estado: "activo" }, FABIO);
    expect((await db().selectFrom("paciente").select("celular_verificado_en").executeTakeFirstOrThrow()).celular_verificado_en).toBeNull();
  });
});

describe("búsqueda y ficha (auditadas)", () => {
  it("busca por nombre sin tildes, por documento y por celular", async () => {
    await crearPaciente(db(), base, FABIO);
    await crearPaciente(db(), { ...base, numeroDocumento: "52000111", nombre: "María Gómez", celular: "3105556677" }, FABIO);
    expect((await buscarPacientes(db(), "jose", FABIO)).map((p) => p.nombre)).toEqual(["José Pérez"]);
    expect((await buscarPacientes(db(), "GOMEZ", FABIO)).map((p) => p.nombre)).toEqual(["María Gómez"]);
    expect((await buscarPacientes(db(), "1020304", FABIO)).map((p) => p.nombre)).toEqual(["José Pérez"]);
    expect((await buscarPacientes(db(), "555 6677", FABIO)).map((p) => p.nombre)).toEqual(["María Gómez"]);
    expect(await buscarPacientes(db(), "x", FABIO)).toEqual([]);
  });

  it("registra búsquedas y lecturas de ficha sin guardar el término buscado", async () => {
    const { id } = await crearPaciente(db(), base, FABIO);
    await buscarPacientes(db(), "José", FABIO);
    await obtenerFicha(db(), id, FABIO);
    const filas = await db().selectFrom("auditoria").select(["accion", "entidad_id", "detalle"]).orderBy("id").execute();
    expect(filas.map((f) => f.accion)).toEqual(["paciente.creado", "paciente.busqueda", "paciente.leido"]);
    expect(filas[2]?.entidad_id).toBe(id);
    expect(JSON.stringify(filas)).not.toContain("José");
  });
});
