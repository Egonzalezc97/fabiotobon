import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { cerrarDb, db } from "@/lib/db";
import { crearBloqueo, intervaloDeDias } from "@/modules/agenda/bloqueos";
import {
  cambiarEstadoCita,
  cancelarCita,
  crearCita,
  marcarCitaVista,
  ocupadosEnRango,
  reprogramarCita,
} from "@/modules/agenda/citas";
import { contarPendientesDeRevisar } from "@/modules/agenda/consultas";
import {
  BloqueoConConflictos,
  ChocaConBloqueo,
  CitaNoActiva,
  CupoNoDisponible,
  FueraDeHorario,
  ServicioNoDisponible,
  TransicionInvalida,
} from "@/modules/agenda/errores";
import { guardarHorario } from "@/modules/agenda/horario";
import { instante, rangoDia } from "@/modules/agenda/tiempo";
import { limpiarDatos } from "./ayudas";

afterAll(cerrarDb);
beforeEach(() => limpiarDatos(db()));

const LUNES = "2026-11-02";
const AHORA = new Date("2026-10-27T15:00:00Z"); // martes anterior: el lunes está dentro del horizonte
const FABIO = { tipo: "usuario" as const, id: "usuario-fabio" };
const h = (hora: string) => {
  const [hh = "0", mm = "0"] = hora.split(":");
  return instante(LUNES, Number(hh) * 60 + Number(mm));
};

async function escenario() {
  const [valoracion, diseno] = await db()
    .insertInto("servicio")
    .values([
      { slug: "valoracion", nombre: "Valoración", duracion_min: 30, politica_reserva: "publico" },
      { slug: "diseno", nombre: "Diseño de sonrisa", duracion_min: 120, politica_reserva: "solo_admin" },
    ])
    .returning("id")
    .execute();
  const dias = [1, 2, 3, 4, 5].flatMap((d) => [
    { dia_semana: d, hora_inicio: "08:00", hora_fin: "12:00" },
    { dia_semana: d, hora_inicio: "14:00", hora_fin: "18:00" },
  ]);
  await db().insertInto("horario_laboral").values(dias).execute();
  const pacientes = await db()
    .insertInto("paciente")
    .values([
      { tipo_documento: "CC", numero_documento: "1000000001", nombre: "Ana Prueba", celular: "+573001110001" },
      { tipo_documento: "CC", numero_documento: "1000000002", nombre: "Beto Prueba", celular: "+573001110002" },
    ])
    .returning("id")
    .execute();
  return { valoracionId: valoracion!.id, disenoId: diseno!.id, anaId: pacientes[0]!.id, betoId: pacientes[1]!.id };
}

function nueva(e: Awaited<ReturnType<typeof escenario>>, inicio: Date, cambios: Partial<Parameters<typeof crearCita>[1]> = {}) {
  return { pacienteId: e.anaId, servicioId: e.valoracionId, inicio, estado: "confirmada" as const, origen: "panel" as const, ...cambios };
}

const eventos = (citaId: string) =>
  db().selectFrom("cita_evento").select(["tipo", "antes", "despues"]).where("cita_id", "=", citaId).orderBy("id").execute();

describe("crear cita desde el panel", () => {
  it("crea la cita con su evento y la marca como vista", async () => {
    const e = await escenario();
    const cita = await crearCita(db(), nueva(e, h("09:00")), { modo: "panel", actor: FABIO });
    expect(cita.fin.getTime() - cita.inicio.getTime()).toBe(30 * 60_000);
    expect((await eventos(cita.id)).map((x) => x.tipo)).toEqual(["creada"]);
    const fila = await db().selectFrom("cita").select(["vista_en", "origen"]).where("id", "=", cita.id).executeTakeFirstOrThrow();
    expect(fila.vista_en).not.toBeNull();
  });

  it("fuera del horario exige confirmación explícita", async () => {
    const e = await escenario();
    await expect(crearCita(db(), nueva(e, h("12:30")), { modo: "panel", actor: FABIO })).rejects.toBeInstanceOf(FueraDeHorario);
    await expect(
      crearCita(db(), nueva(e, h("12:30")), { modo: "panel", permitirFueraDeHorario: true, actor: FABIO }),
    ).resolves.toBeDefined();
  });

  it("nunca sobre un bloqueo, ni con confirmación", async () => {
    const e = await escenario();
    await crearBloqueo(db(), { inicio: h("09:00"), fin: h("10:00"), diaCompleto: false, motivo: "Reunión" }, [], { actor: FABIO });
    await expect(
      crearCita(db(), nueva(e, h("09:30")), { modo: "panel", permitirFueraDeHorario: true, actor: FABIO }),
    ).rejects.toBeInstanceOf(ChocaConBloqueo);
  });

  it("no agenda servicios inactivos", async () => {
    const e = await escenario();
    await db().updateTable("servicio").set({ activo: false }).where("id", "=", e.disenoId).execute();
    await expect(
      crearCita(db(), nueva(e, h("08:00"), { servicioId: e.disenoId }), { modo: "panel", actor: FABIO }),
    ).rejects.toBeInstanceOf(ServicioNoDisponible);
  });
});

describe("crear cita en modo público", () => {
  const publico = { modo: "publico" as const, ahora: AHORA, actor: { tipo: "paciente" as const } };

  it("acepta solo cupos ofrecidos", async () => {
    const e = await escenario();
    await expect(crearCita(db(), nueva(e, h("08:15"), { origen: "web" }), publico)).resolves.toBeDefined();
    await expect(crearCita(db(), nueva(e, h("08:50"), { origen: "web" }), publico)).rejects.toBeInstanceOf(CupoNoDisponible);
    await expect(crearCita(db(), nueva(e, h("12:00"), { origen: "web" }), publico)).rejects.toBeInstanceOf(CupoNoDisponible);
  });

  it("respeta antelación y horizonte", async () => {
    const e = await escenario();
    const ahoraMismo = { ...publico, ahora: instante(LUNES, 8 * 60) };
    await expect(crearCita(db(), nueva(e, h("09:00"), { origen: "web" }), ahoraMismo)).rejects.toBeInstanceOf(CupoNoDisponible);
    await expect(crearCita(db(), nueva(e, h("10:00"), { origen: "web" }), ahoraMismo)).resolves.toBeDefined();
    const muyAntes = { ...publico, ahora: new Date("2026-09-01T15:00:00Z") };
    await expect(crearCita(db(), nueva(e, h("11:00"), { origen: "web" }), muyAntes)).rejects.toBeInstanceOf(CupoNoDisponible);
  });

  it("no permite reservar servicios que no son públicos", async () => {
    const e = await escenario();
    await expect(
      crearCita(db(), nueva(e, h("08:00"), { servicioId: e.disenoId, origen: "web" }), publico),
    ).rejects.toBeInstanceOf(ServicioNoDisponible);
  });

  it("las citas web nacen sin ver y suman en los indicadores hasta que Fabio las abre", async () => {
    const e = await escenario();
    const web = await crearCita(db(), nueva(e, h("08:00"), { origen: "web" }), publico);
    const revisar = await crearCita(db(), nueva(e, h("09:00"), { origen: "web", revision: "documento_con_otro_celular" }), publico);
    expect(await contarPendientesDeRevisar(db())).toEqual({ webNuevas: 1, enRevision: 1 });
    expect(await marcarCitaVista(db(), web.id, { actor: FABIO })).toBe(true);
    expect(await marcarCitaVista(db(), web.id, { actor: FABIO })).toBe(false);
    await marcarCitaVista(db(), revisar.id, { actor: FABIO });
    expect(await contarPendientesDeRevisar(db())).toEqual({ webNuevas: 0, enRevision: 0 });
    expect((await eventos(web.id)).map((x) => x.tipo)).toEqual(["creada", "vista"]);
  });
});

describe("concurrencia a través del módulo", () => {
  it("varias reservas simultáneas del mismo cupo: exactamente una gana", async () => {
    const e = await escenario();
    const resultados = await Promise.allSettled(
      Array.from({ length: 6 }, (_, i) =>
        crearCita(db(), nueva(e, h("10:00"), { pacienteId: i % 2 ? e.anaId : e.betoId, origen: "web" }), {
          modo: "publico",
          ahora: AHORA,
          actor: { tipo: "paciente" },
        }),
      ),
    );
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rechazos = resultados.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(rechazos.every((r) => r.reason instanceof CupoNoDisponible)).toBe(true);
    expect(await db().selectFrom("cita").select("id").execute()).toHaveLength(1);
  });

  it("citas que se cruzan con inicios distintos: una sola gana", async () => {
    const e = await escenario();
    const resultados = await Promise.allSettled([
      crearCita(db(), nueva(e, h("08:00"), { servicioId: e.disenoId }), { modo: "panel", actor: FABIO }),
      crearCita(db(), nueva(e, h("09:00"), { pacienteId: e.betoId }), { modo: "panel", actor: FABIO }),
    ]);
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });

  it("bloqueo y reserva simultáneos sobre el mismo horario: nunca quedan los dos", async () => {
    for (let ronda = 0; ronda < 5; ronda++) {
      await limpiarDatos(db());
      const e = await escenario();
      const [bloqueo, cita] = await Promise.allSettled([
        crearBloqueo(db(), { inicio: h("10:00"), fin: h("11:00"), diaCompleto: false, motivo: "Personal" }, [], { actor: FABIO }),
        crearCita(db(), nueva(e, h("10:00"), { origen: "web" }), { modo: "publico", ahora: AHORA, actor: { tipo: "paciente" } }),
      ]);
      const ganaron = [bloqueo, cita].filter((r) => r.status === "fulfilled").length;
      expect(ganaron).toBe(1);
      if (bloqueo.status === "rejected") expect(bloqueo.reason).toBeInstanceOf(BloqueoConConflictos);
      if (cita.status === "rejected") expect(cita.reason).toBeInstanceOf(ChocaConBloqueo);
    }
  });
});

describe("reprogramar, cancelar y cambiar estado", () => {
  it("reprogramar a un horario ocupado conserva el horario original y no deja evento", async () => {
    const e = await escenario();
    const a = await crearCita(db(), nueva(e, h("08:00")), { modo: "panel", actor: FABIO });
    await crearCita(db(), nueva(e, h("09:00"), { pacienteId: e.betoId }), { modo: "panel", actor: FABIO });

    await expect(reprogramarCita(db(), a.id, h("09:15"), { actor: FABIO })).rejects.toBeInstanceOf(CupoNoDisponible);

    const fila = await db().selectFrom("cita").select(["inicio", "fin"]).where("id", "=", a.id).executeTakeFirstOrThrow();
    expect(fila.inicio.toISOString()).toBe(h("08:00").toISOString());
    expect((await eventos(a.id)).map((x) => x.tipo)).toEqual(["creada"]);
  });

  it("reprogramar actualiza la misma cita y registra horario anterior y nuevo", async () => {
    const e = await escenario();
    const a = await crearCita(db(), nueva(e, h("08:00")), { modo: "panel", actor: FABIO });
    await reprogramarCita(db(), a.id, h("15:00"), { actor: FABIO });
    expect(await db().selectFrom("cita").select("id").execute()).toHaveLength(1);
    const evento = (await eventos(a.id)).at(-1);
    expect(evento).toMatchObject({
      tipo: "reprogramada",
      antes: { inicio: h("08:00").toISOString() },
      despues: { inicio: h("15:00").toISOString(), fin: h("15:30").toISOString() },
    });
  });

  it("puede moverse a un horario que se solapa con su propio horario actual", async () => {
    const e = await escenario();
    const a = await crearCita(db(), nueva(e, h("08:00"), { servicioId: e.disenoId }), { modo: "panel", actor: FABIO });
    await expect(reprogramarCita(db(), a.id, h("08:30"), { actor: FABIO })).resolves.toBeDefined();
  });

  it("cancelar libera el cupo; una cita cancelada no se mueve ni se reactiva", async () => {
    const e = await escenario();
    const a = await crearCita(db(), nueva(e, h("08:00")), { modo: "panel", actor: FABIO });
    await cancelarCita(db(), a.id, { actor: FABIO });
    await expect(crearCita(db(), nueva(e, h("08:00"), { pacienteId: e.betoId }), { modo: "panel", actor: FABIO })).resolves.toBeDefined();
    await expect(cancelarCita(db(), a.id, { actor: FABIO })).rejects.toBeInstanceOf(CitaNoActiva);
    await expect(reprogramarCita(db(), a.id, h("15:00"), { actor: FABIO })).rejects.toBeInstanceOf(CitaNoActiva);
    await expect(cambiarEstadoCita(db(), a.id, "confirmada", { actor: FABIO })).rejects.toBeInstanceOf(TransicionInvalida);
  });

  it("cambia de estado según las transiciones permitidas y deja evento", async () => {
    const e = await escenario();
    const a = await crearCita(db(), nueva(e, h("08:00"), { estado: "pendiente" }), { modo: "panel", actor: FABIO });
    await cambiarEstadoCita(db(), a.id, "confirmada", { actor: FABIO });
    await cambiarEstadoCita(db(), a.id, "cumplida", { actor: FABIO });
    await cambiarEstadoCita(db(), a.id, "no_asistio", { actor: FABIO });
    await expect(cambiarEstadoCita(db(), a.id, "pendiente", { actor: FABIO })).rejects.toBeInstanceOf(TransicionInvalida);
    expect((await eventos(a.id)).map((x) => x.tipo)).toEqual(["creada", "estado_cambiado", "estado_cambiado", "estado_cambiado"]);
  });
});

describe("bloqueos sobre citas existentes", () => {
  it("sin citas afectadas se guarda directamente", async () => {
    await escenario();
    await crearBloqueo(db(), { ...intervaloDeDias(LUNES, LUNES), diaCompleto: true, motivo: "Congreso" }, [], { actor: FABIO });
    expect(await db().selectFrom("bloqueo").select("id").execute()).toHaveLength(1);
  });

  it("con citas afectadas y sin decisiones no se guarda y devuelve la lista", async () => {
    const e = await escenario();
    const a = await crearCita(db(), nueva(e, h("08:00")), { modo: "panel", actor: FABIO });
    const b = await crearCita(db(), nueva(e, h("15:00"), { pacienteId: e.betoId }), { modo: "panel", actor: FABIO });
    const intento = crearBloqueo(db(), { ...intervaloDeDias(LUNES, LUNES), diaCompleto: true, motivo: "Vacaciones" }, [], { actor: FABIO });
    await expect(intento).rejects.toBeInstanceOf(BloqueoConConflictos);
    const error = (await intento.catch((x: unknown) => x)) as BloqueoConConflictos;
    expect(error.afectadas.map((c) => c.id).sort()).toEqual([a.id, b.id].sort());
    expect(error.afectadas[0]).toMatchObject({ pacienteNombre: "Ana Prueba", servicioNombre: "Valoración" });
    expect(await db().selectFrom("bloqueo").select("id").execute()).toHaveLength(0);
  });

  it("con decisiones incompletas tampoco se guarda nada", async () => {
    const e = await escenario();
    const a = await crearCita(db(), nueva(e, h("08:00")), { modo: "panel", actor: FABIO });
    await crearCita(db(), nueva(e, h("15:00"), { pacienteId: e.betoId }), { modo: "panel", actor: FABIO });
    await expect(
      crearBloqueo(db(), { ...intervaloDeDias(LUNES, LUNES), diaCompleto: true, motivo: "" }, [{ citaId: a.id, accion: "cancelar" }], { actor: FABIO }),
    ).rejects.toBeInstanceOf(BloqueoConConflictos);
    const estado = await db().selectFrom("cita").select("estado").where("id", "=", a.id).executeTakeFirstOrThrow();
    expect(estado.estado).toBe("confirmada");
  });

  it("con todas las decisiones aplica cancelaciones, reprogramaciones y el bloqueo juntos", async () => {
    const e = await escenario();
    const a = await crearCita(db(), nueva(e, h("08:00")), { modo: "panel", actor: FABIO });
    const b = await crearCita(db(), nueva(e, h("15:00"), { pacienteId: e.betoId }), { modo: "panel", actor: FABIO });
    const martes = instante("2026-11-03", 9 * 60);
    await crearBloqueo(
      db(),
      { ...intervaloDeDias(LUNES, LUNES), diaCompleto: true, motivo: "Vacaciones" },
      [
        { citaId: a.id, accion: "cancelar" },
        { citaId: b.id, accion: "reprogramar", nuevoInicio: martes },
      ],
      { actor: FABIO },
    );
    const filas = await db().selectFrom("cita").select(["id", "estado", "inicio"]).execute();
    expect(filas.find((f) => f.id === a.id)?.estado).toBe("cancelada");
    expect(filas.find((f) => f.id === b.id)?.inicio.toISOString()).toBe(martes.toISOString());
    expect(await db().selectFrom("bloqueo").select("id").execute()).toHaveLength(1);
  });

  it("si una reprogramación cae dentro del propio bloqueo, se revierte todo", async () => {
    const e = await escenario();
    const a = await crearCita(db(), nueva(e, h("08:00")), { modo: "panel", actor: FABIO });
    const b = await crearCita(db(), nueva(e, h("09:00"), { pacienteId: e.betoId }), { modo: "panel", actor: FABIO });
    await expect(
      crearBloqueo(
        db(),
        { ...intervaloDeDias(LUNES, LUNES), diaCompleto: true, motivo: "" },
        [
          { citaId: a.id, accion: "cancelar" },
          { citaId: b.id, accion: "reprogramar", nuevoInicio: h("16:00") },
        ],
        { actor: FABIO },
      ),
    ).rejects.toBeInstanceOf(ChocaConBloqueo);
    expect(await db().selectFrom("bloqueo").select("id").execute()).toHaveLength(0);
    const estados = await db().selectFrom("cita").select(["estado"]).execute();
    expect(estados.every((x) => x.estado === "confirmada")).toBe(true);
  });
});

describe("lo que se expone para calcular cupos", () => {
  it("ocupadosEnRango solo trae tiempos, sin motivos ni pacientes", async () => {
    const e = await escenario();
    await crearCita(db(), nueva(e, h("08:00")), { modo: "panel", actor: FABIO });
    await crearBloqueo(db(), { inicio: h("15:00"), fin: h("16:00"), diaCompleto: false, motivo: "Cita médica personal" }, [], { actor: FABIO });
    const ocupados = await ocupadosEnRango(db(), rangoDia(LUNES));
    expect(ocupados).toHaveLength(2);
    for (const o of ocupados) expect(Object.keys(o).sort()).toEqual(["fin", "inicio"]);
    expect(JSON.stringify(ocupados)).not.toContain("personal");
  });
});

describe("horario laboral", () => {
  it("al cambiarlo advierte las citas futuras que quedan por fuera, sin bloquear el cambio", async () => {
    const e = await escenario();
    const tarde = await crearCita(db(), nueva(e, h("15:00")), { modo: "panel", actor: FABIO });
    const { fueraDeHorario } = await guardarHorario(db(), { 1: [{ inicioMin: 8 * 60, finMin: 12 * 60 }] }, { actor: FABIO, ahora: AHORA });
    expect(fueraDeHorario.map((c) => c.id)).toEqual([tarde.id]);
    expect(await db().selectFrom("horario_laboral").select("id").execute()).toHaveLength(1);
  });

  it("rechaza tramos superpuestos sin perder el horario anterior", async () => {
    await escenario();
    await expect(
      guardarHorario(db(), { 1: [{ inicioMin: 8 * 60, finMin: 12 * 60 }, { inicioMin: 11 * 60, finMin: 13 * 60 }] }, { actor: FABIO }),
    ).rejects.toThrow(/horario_laboral_sin_solapes/);
    expect(await db().selectFrom("horario_laboral").select("id").execute()).toHaveLength(10);
  });
});
