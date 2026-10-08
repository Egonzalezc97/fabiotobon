import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { cerrarDb, db } from "@/lib/db";
import {
  ajustarCosto,
  anularAbono,
  cambiarEstadoTratamiento,
  cancelarTratamiento,
  crearTratamiento,
  ErrorTratamiento,
  listarTratamientosPaciente,
  obtenerTratamiento,
  registrarAbono,
  resumenCartera,
  SaldoAFavorSinConfirmar,
} from "@/modules/tratamientos";
import { limpiarDatos } from "./ayudas";

afterAll(cerrarDb);
beforeEach(() => limpiarDatos(db()));

const FABIO = { userId: "usuario-fabio" };

async function paciente(numero = "1000000001") {
  return db()
    .insertInto("paciente")
    .values({ tipo_documento: "CC", numero_documento: numero, nombre: `Paciente ${numero}` })
    .returning("id")
    .executeTakeFirstOrThrow();
}

async function saldo(tratamientoId: string) {
  return db().selectFrom("tratamiento_saldo").selectAll().where("tratamiento_id", "=", tratamientoId).executeTakeFirstOrThrow();
}

const abono = (tratamientoId: string, valor: number, extra: { confirmaSaldoAFavor?: boolean } = {}) =>
  registrarAbono(db(), { tratamientoId, valor, fecha: "2026-10-08", medio: "efectivo", ...extra }, FABIO);

describe("tratamientos y saldos calculados", () => {
  it("saldo y estado de pago salen de los abonos vigentes: sin abonos, con saldo, saldado", async () => {
    const p = await paciente();
    const t = await crearTratamiento(db(), { pacienteId: p.id, descripcion: "Diseño de sonrisa", costoTotal: 1_000_000, estado: "en_curso" }, FABIO);
    expect(await saldo(t.id)).toMatchObject({ abonado: 0, saldo: 1_000_000, estado_pago: "sin_abonos" });
    await abono(t.id, 400_000);
    expect(await saldo(t.id)).toMatchObject({ abonado: 400_000, saldo: 600_000, estado_pago: "con_saldo" });
    await abono(t.id, 600_000);
    expect(await saldo(t.id)).toMatchObject({ saldo: 0, estado_pago: "saldado" });
  });

  it("exige servicio o descripción y valores enteros", async () => {
    const p = await paciente();
    await expect(crearTratamiento(db(), { pacienteId: p.id, costoTotal: 1000 }, FABIO)).rejects.toBeInstanceOf(ErrorTratamiento);
    await expect(crearTratamiento(db(), { pacienteId: p.id, descripcion: "X", costoTotal: 10.5 }, FABIO)).rejects.toThrow(/entero/);
  });
});

describe("tope de abonos", () => {
  it("la suma de abonos vigentes no supera el costo, salvo confirmación de saldo a favor", async () => {
    const p = await paciente();
    const t = await crearTratamiento(db(), { pacienteId: p.id, descripcion: "Limpieza", costoTotal: 150_000 }, FABIO);
    await abono(t.id, 100_000);
    const intento = abono(t.id, 80_000);
    await expect(intento).rejects.toBeInstanceOf(SaldoAFavorSinConfirmar);
    expect(((await intento.catch((e: unknown) => e)) as SaldoAFavorSinConfirmar).excedente).toBe(30_000);
    await abono(t.id, 80_000, { confirmaSaldoAFavor: true });
    expect(await saldo(t.id)).toMatchObject({ saldo: -30_000, estado_pago: "saldo_a_favor" });
  });

  it("la base lo garantiza también ante un INSERT directo", async () => {
    const p = await paciente();
    const t = await crearTratamiento(db(), { pacienteId: p.id, descripcion: "Limpieza", costoTotal: 100 }, FABIO);
    await expect(db().insertInto("abono").values({ tratamiento_id: t.id, valor: 101, fecha: "2026-10-08", medio: "otro" }).execute()).rejects.toThrow(/TOPE_ABONOS/);
  });

  it("dos abonos simultáneos no pueden pasarse del tope", async () => {
    const p = await paciente();
    const t = await crearTratamiento(db(), { pacienteId: p.id, descripcion: "Corona", costoTotal: 1_000_000 }, FABIO);
    const resultados = await Promise.allSettled(Array.from({ length: 6 }, () => abono(t.id, 300_000)));
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(3);
    expect((await saldo(t.id)).abonado).toBe(900_000);
  });

  it("bajar el costo por debajo de lo abonado exige confirmación", async () => {
    const p = await paciente();
    const t = await crearTratamiento(db(), { pacienteId: p.id, descripcion: "Blanqueamiento", costoTotal: 900_000 }, FABIO);
    await abono(t.id, 800_000);
    await expect(ajustarCosto(db(), t.id, { costoTotal: 700_000, motivo: "Descuento" }, FABIO)).rejects.toBeInstanceOf(SaldoAFavorSinConfirmar);
    expect((await saldo(t.id)).base).toBe(900_000);
    await ajustarCosto(db(), t.id, { costoTotal: 700_000, motivo: "Descuento", confirmaSaldoAFavor: true }, FABIO);
    expect(await saldo(t.id)).toMatchObject({ base: 700_000, saldo: -100_000 });
  });
});

describe("ajustes, estados y cancelación", () => {
  it("el ajuste de costo deja evento con valor anterior, nuevo y motivo; el costo inicial no cambia", async () => {
    const p = await paciente();
    const t = await crearTratamiento(db(), { pacienteId: p.id, descripcion: "Rehabilitación", costoTotal: 5_000_000 }, FABIO);
    await expect(ajustarCosto(db(), t.id, { costoTotal: 4_500_000, motivo: "" }, FABIO)).rejects.toThrow(/motivo/);
    await ajustarCosto(db(), t.id, { costoTotal: 4_500_000, motivo: "Descuento acordado" }, FABIO);
    const detalle = await obtenerTratamiento(db(), t.id, FABIO);
    expect(detalle?.tratamiento).toMatchObject({ costo_inicial: 5_000_000, costo_total: 4_500_000 });
    expect(detalle?.eventos[0]).toMatchObject({
      tipo: "costo_ajustado",
      antes: { costo_total: 5_000_000 },
      despues: { costo_total: 4_500_000 },
      motivo: "Descuento acordado",
    });
    await expect(db().updateTable("tratamiento").set({ costo_inicial: 1 }).where("id", "=", t.id).execute()).rejects.toThrow(/costo_inicial/);
  });

  it("cancelar usa por defecto lo abonado como valor realizado (queda saldado) y exige motivo", async () => {
    const p = await paciente();
    const t = await crearTratamiento(db(), { pacienteId: p.id, descripcion: "Ortodoncia", costoTotal: 3_000_000, estado: "en_curso" }, FABIO);
    await abono(t.id, 1_200_000);
    await expect(cancelarTratamiento(db(), t.id, { motivo: "" }, FABIO)).rejects.toThrow(/motivo/);
    await cancelarTratamiento(db(), t.id, { motivo: "El paciente se mudó" }, FABIO);
    expect(await saldo(t.id)).toMatchObject({ estado: "cancelado", base: 1_200_000, saldo: 0, estado_pago: "saldado" });
  });

  it("cancelar con un valor realizado mayor a lo abonado deja deuda; menor, saldo a favor (con confirmación)", async () => {
    const p = await paciente();
    const deuda = await crearTratamiento(db(), { pacienteId: p.id, descripcion: "A", costoTotal: 2_000_000, estado: "en_curso" }, FABIO);
    await abono(deuda.id, 500_000);
    await cancelarTratamiento(db(), deuda.id, { valorRealizado: 800_000, motivo: "Hecho parcialmente" }, FABIO);
    expect(await saldo(deuda.id)).toMatchObject({ saldo: 300_000, estado_pago: "con_saldo" });

    const aFavor = await crearTratamiento(db(), { pacienteId: p.id, descripcion: "B", costoTotal: 2_000_000, estado: "en_curso" }, FABIO);
    await abono(aFavor.id, 500_000);
    await expect(cancelarTratamiento(db(), aFavor.id, { valorRealizado: 200_000, motivo: "Poco realizado" }, FABIO)).rejects.toBeInstanceOf(
      SaldoAFavorSinConfirmar,
    );
    await cancelarTratamiento(db(), aFavor.id, { valorRealizado: 200_000, motivo: "Poco realizado", confirmaSaldoAFavor: true }, FABIO);
    expect(await saldo(aFavor.id)).toMatchObject({ saldo: -300_000, estado_pago: "saldo_a_favor" });
  });

  it("los estados siguen sus transiciones", async () => {
    const p = await paciente();
    const t = await crearTratamiento(db(), { pacienteId: p.id, descripcion: "X", costoTotal: 1000 }, FABIO);
    await cambiarEstadoTratamiento(db(), t.id, "en_curso", FABIO);
    await cambiarEstadoTratamiento(db(), t.id, "terminado", FABIO);
    await expect(cambiarEstadoTratamiento(db(), t.id, "presupuestado", FABIO)).rejects.toThrow(/no está permitido/);
    const [fila] = await listarTratamientosPaciente(db(), p.id);
    expect(fila?.fecha_inicio).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("abonos: no se borran, se anulan una vez", () => {
  it("anular exige motivo, libera el tope y no se repite; borrar o editar está prohibido", async () => {
    const p = await paciente();
    const t = await crearTratamiento(db(), { pacienteId: p.id, descripcion: "X", costoTotal: 100_000 }, FABIO);
    const a = await abono(t.id, 100_000);
    await expect(anularAbono(db(), a.id, "", FABIO)).rejects.toThrow(/motivo/);
    await anularAbono(db(), a.id, "Error de digitación", FABIO);
    expect(await saldo(t.id)).toMatchObject({ abonado: 0, estado_pago: "sin_abonos" });
    await expect(anularAbono(db(), a.id, "Otra vez", FABIO)).rejects.toThrow(/ya está anulado/);
    await expect(db().deleteFrom("abono").where("id", "=", a.id).execute()).rejects.toThrow(/no se borra/);
    await expect(db().updateTable("abono").set({ valor: 1 }).where("id", "=", a.id).execute()).rejects.toThrow(/no se borra/);
    await abono(t.id, 100_000);
  });
});

describe("cartera", () => {
  it("por paciente: sin tratamientos, presupuestado no cuenta como deuda, y suma de saldos", async () => {
    const p = await paciente();
    const cartera = () => db().selectFrom("paciente_cartera").selectAll().where("paciente_id", "=", p.id).executeTakeFirstOrThrow();
    expect((await cartera()).estado_pago).toBe("sin_tratamientos");
    await crearTratamiento(db(), { pacienteId: p.id, descripcion: "Presupuesto", costoTotal: 9_000_000 }, FABIO);
    expect(await cartera()).toMatchObject({ estado_pago: "sin_tratamientos", saldo: 0 });
    const t = await crearTratamiento(db(), { pacienteId: p.id, descripcion: "En curso", costoTotal: 1_000_000, estado: "en_curso" }, FABIO);
    await abono(t.id, 250_000);
    expect(await cartera()).toMatchObject({ estado_pago: "con_saldo", saldo: 750_000, abonado: 250_000 });
  });

  it("resumen de Inicio: total por cobrar, pacientes con saldo y abonos del mes", async () => {
    const a = await paciente("1000000001");
    const b = await paciente("1000000002");
    const t1 = await crearTratamiento(db(), { pacienteId: a.id, descripcion: "X", costoTotal: 1_000_000, estado: "en_curso" }, FABIO);
    const t2 = await crearTratamiento(db(), { pacienteId: b.id, descripcion: "Y", costoTotal: 500_000, estado: "terminado" }, FABIO);
    await abono(t1.id, 200_000);
    await registrarAbono(db(), { tratamientoId: t2.id, valor: 100_000, fecha: "2026-09-30", medio: "transferencia" }, FABIO);
    expect(await resumenCartera(db(), "2026-10")).toEqual({ porCobrar: 1_200_000, pacientesConSaldo: 2, abonosDelMes: 200_000, presupuestado: 0 });
  });
});
