import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { cerrarDb, db } from "@/lib/db";
import { normalizarCelular } from "@/lib/telefono";
import {
  actualizarPaciente,
  buscarPacientes,
  crearPaciente,
  DatosPacienteInvalidos,
  DocumentoDuplicado,
  fusionarPacientes,
  listarTablaPacientes,
  obtenerFicha,
} from "@/modules/pacientes";
import { crearTratamiento, registrarAbono } from "@/modules/tratamientos";
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

describe("historial de la ficha", () => {
  it("guarda campo por campo el valor anterior y el nuevo, con quién", async () => {
    const { id } = await crearPaciente(db(), base, FABIO);
    await actualizarPaciente(db(), id, { ...base, telefono: "604 444 5566", fechaNacimiento: "1990-05-17", estado: "activo" }, FABIO);
    // Guardar sin cambios no deja evento.
    await actualizarPaciente(db(), id, { ...base, telefono: "604 444 5566", fechaNacimiento: "1990-05-17", estado: "activo" }, FABIO);
    const ficha = await obtenerFicha(db(), id, FABIO);
    expect(ficha?.eventos.map((e) => e.tipo)).toEqual(["actualizado", "creado"]);
    expect(ficha?.eventos[0]?.cambios).toEqual({
      telefono: { antes: null, despues: "604 444 5566" },
      fecha_nacimiento: { antes: null, despues: "1990-05-17" },
    });
    expect(ficha?.paciente.fecha_nacimiento).toBe("1990-05-17");
  });

  it("rechaza fechas de nacimiento futuras o inválidas", async () => {
    await expect(crearPaciente(db(), { ...base, fechaNacimiento: "2999-01-01" }, FABIO)).rejects.toThrow(/nacimiento/);
  });
});

describe("fusión de fichas", () => {
  it("mueve citas, tratamientos y consentimientos a la ficha que queda y deja eventos en todo", async () => {
    const destino = await crearPaciente(db(), base, FABIO);
    const origen = await crearPaciente(db(), { ...base, numeroDocumento: "52000111", nombre: "Jose Perez", celular: "3105556677" }, FABIO);
    const servicio = await db().insertInto("servicio").values({ slug: "s", nombre: "S", duracion_min: 30 }).returning("id").executeTakeFirstOrThrow();
    const cita = await db()
      .insertInto("cita")
      .values({ paciente_id: origen.id, servicio_id: servicio.id, inicio: "2026-11-02T13:00:00Z", fin: "2026-11-02T13:30:00Z", estado: "confirmada", origen: "web" })
      .returning("id")
      .executeTakeFirstOrThrow();
    const trat = await crearTratamiento(db(), { pacienteId: origen.id, descripcion: "Limpieza", costoTotal: 100_000 }, FABIO);
    await db()
      .insertInto("consentimiento")
      .values({ paciente_id: origen.id, tipo: "tratamiento_datos", version: "v1", texto: "Texto", texto_sha256: "a".repeat(64), origen: "web" })
      .execute();

    const resumen = await fusionarPacientes(db(), { destinoId: destino.id, origenId: origen.id }, FABIO);
    expect(resumen).toEqual({ citas: 1, tratamientos: 1, consentimientos: 1, consentimientos_imagen: 0 });

    expect((await db().selectFrom("cita").select("paciente_id").executeTakeFirstOrThrow()).paciente_id).toBe(destino.id);
    expect((await db().selectFrom("tratamiento").select("paciente_id").executeTakeFirstOrThrow()).paciente_id).toBe(destino.id);
    expect((await db().selectFrom("consentimiento").select("paciente_id").executeTakeFirstOrThrow()).paciente_id).toBe(destino.id);

    const absorbida = await db().selectFrom("paciente").selectAll().where("id", "=", origen.id).executeTakeFirstOrThrow();
    expect(absorbida).toMatchObject({ fusionado_con: destino.id, estado: "inactivo", numero_documento: null });
    // El documento liberado ya se puede usar (una reserva futura no apunta a la ficha absorbida).
    expect(await buscarPacientes(db(), "52000111", FABIO)).toEqual([]);

    const eventosCita = await db().selectFrom("cita_evento").select("tipo").where("cita_id", "=", cita.id).execute();
    expect(eventosCita.map((e) => e.tipo)).toContain("paciente_cambiado");
    const eventosTrat = await db().selectFrom("tratamiento_evento").select("tipo").where("tratamiento_id", "=", trat.id).execute();
    expect(eventosTrat.map((e) => e.tipo)).toContain("paciente_cambiado");
    const eventoDestino = await db().selectFrom("paciente_evento").selectAll().where("paciente_id", "=", destino.id).where("tipo", "=", "fusion_recibida").executeTakeFirstOrThrow();
    expect(eventoDestino.cambios).toMatchObject({ origen_documento: "CC 52000111", citas: 1 });
  });

  it("no fusiona una ficha consigo misma ni una ya fusionada; la absorbida no se edita", async () => {
    const a = await crearPaciente(db(), base, FABIO);
    const b = await crearPaciente(db(), { ...base, numeroDocumento: "52000111" }, FABIO);
    await expect(fusionarPacientes(db(), { destinoId: a.id, origenId: a.id }, FABIO)).rejects.toThrow(/distintas/);
    await fusionarPacientes(db(), { destinoId: a.id, origenId: b.id }, FABIO);
    await expect(fusionarPacientes(db(), { destinoId: a.id, origenId: b.id }, FABIO)).rejects.toThrow(/ya fue fusionada/);
    await expect(actualizarPaciente(db(), b.id, { ...base, numeroDocumento: "52000111", estado: "activo" }, FABIO)).rejects.toThrow(/fusionó/);
  });

  it("fuera de una fusión, un consentimiento no cambia de ficha", async () => {
    const a = await crearPaciente(db(), base, FABIO);
    const b = await crearPaciente(db(), { ...base, numeroDocumento: "52000111" }, FABIO);
    const c = await db()
      .insertInto("consentimiento")
      .values({ paciente_id: a.id, tipo: "tratamiento_datos", version: "v1", texto: "Texto", texto_sha256: "a".repeat(64), origen: "web" })
      .returning("id")
      .executeTakeFirstOrThrow();
    await expect(db().updateTable("consentimiento").set({ paciente_id: b.id }).where("id", "=", c.id).execute()).rejects.toThrow(/solo inserción/);
  });
});

describe("tabla de pacientes (CRM)", () => {
  async function poblar() {
    const nombres = ["Ana Ruiz", "Bruno Díaz", "Carla Gómez", "Daniel Pérez"];
    const ids: string[] = [];
    for (const [i, nombre] of nombres.entries()) {
      ids.push((await crearPaciente(db(), { ...base, numeroDocumento: `2000000${i}`, nombre, celular: null }, FABIO)).id);
    }
    // Bruno con saldo, Carla saldada, Daniel inactivo.
    const t1 = await crearTratamiento(db(), { pacienteId: ids[1]!, descripcion: "X", costoTotal: 500_000, estado: "en_curso" }, FABIO);
    await registrarAbono(db(), { tratamientoId: t1.id, valor: 100_000, fecha: "2026-10-01", medio: "efectivo" }, FABIO);
    const t2 = await crearTratamiento(db(), { pacienteId: ids[2]!, descripcion: "Y", costoTotal: 200_000, estado: "terminado" }, FABIO);
    await registrarAbono(db(), { tratamientoId: t2.id, valor: 200_000, fecha: "2026-10-01", medio: "efectivo" }, FABIO);
    await db().updateTable("paciente").set({ estado: "inactivo" }).where("id", "=", ids[3]!).execute();
    return ids;
  }

  it("filtra por estado de pago y estado, ordena por saldo y no muestra fichas fusionadas", async () => {
    const ids = await poblar();
    const conSaldo = await listarTablaPacientes(db(), { estadoPago: "con_saldo" }, FABIO);
    expect(conSaldo.filas.map((f) => f.nombre)).toEqual(["Bruno Díaz"]);
    expect(conSaldo.filas[0]?.saldo).toBe(400_000);
    expect((await listarTablaPacientes(db(), { estado: "inactivo" }, FABIO)).filas.map((f) => f.nombre)).toEqual(["Daniel Pérez"]);
    const porSaldo = await listarTablaPacientes(db(), { orden: "saldo", direccion: "desc" }, FABIO);
    expect(porSaldo.filas[0]?.nombre).toBe("Bruno Díaz");
    await fusionarPacientes(db(), { destinoId: ids[0]!, origenId: ids[3]! }, FABIO);
    expect((await listarTablaPacientes(db(), {}, FABIO)).total).toBe(3);
  });

  it("busca sin tildes, filtra por cita próxima y pagina en el servidor", async () => {
    await poblar();
    expect((await listarTablaPacientes(db(), { termino: "diaz" }, FABIO)).filas.map((f) => f.nombre)).toEqual(["Bruno Díaz"]);
    expect((await listarTablaPacientes(db(), { conCitaProxima: true }, FABIO)).total).toBe(0);
    for (let i = 0; i < 30; i++) await crearPaciente(db(), { ...base, numeroDocumento: `3000000${String(i).padStart(2, "0")}`, nombre: `Relleno ${i}` }, FABIO);
    const p2 = await listarTablaPacientes(db(), { pagina: 2 }, FABIO);
    expect(p2.total).toBe(34);
    expect(p2.filas).toHaveLength(9);
    const auditoria = await db().selectFrom("auditoria").select("detalle").where("accion", "=", "paciente.listado").execute();
    expect(JSON.stringify(auditoria)).not.toContain("diaz");
  });
});
