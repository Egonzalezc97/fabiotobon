import { describe, expect, it } from "vitest";
import type { CitaAgenda } from "@/modules/agenda/consultas";
import { horaLocal, instante } from "@/modules/agenda/tiempo";
import { elementosDelDia, rangoVisible } from "@/modules/agenda/vista";

const LUNES = "2026-11-02";
const h = (hora: string) => instante(LUNES, Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3)));
const horario = { 1: [{ inicioMin: 8 * 60, finMin: 12 * 60 }, { inicioMin: 14 * 60, finMin: 18 * 60 }] };
const cita = (inicio: string, fin: string, estado = "confirmada"): CitaAgenda => ({
  id: inicio, inicio: h(inicio), fin: h(fin), estado, origen: "panel", revision: null, vista_en: new Date(),
  pacienteNombre: "X", servicioNombre: "Y",
});

describe("lista del día", () => {
  it("intercala citas, bloqueos y huecos libres en orden", () => {
    const elementos = elementosDelDia(LUNES, horario, [cita("09:00", "10:00")], [
      { id: "b", inicio: h("15:00"), fin: h("16:00"), dia_completo: false, motivo: "" },
    ]);
    expect(elementos.map((e) => `${e.tipo} ${horaLocal(e.inicio)}-${horaLocal(e.fin)}`)).toEqual([
      "libre 08:00-09:00",
      "cita 09:00-10:00",
      "libre 10:00-12:00",
      "libre 14:00-15:00",
      "bloqueo 15:00-16:00",
      "libre 16:00-18:00",
    ]);
  });

  it("una cita cancelada o cumplida no ocupa el hueco libre", () => {
    const elementos = elementosDelDia(LUNES, horario, [cita("09:00", "10:00", "cancelada")], []);
    expect(elementos.filter((e) => e.tipo === "libre").map((e) => horaLocal(e.inicio))).toContain("08:00");
    expect(elementos.find((e) => e.tipo === "libre" && horaLocal(e.inicio) === "08:00")?.fin.getTime()).toBe(h("12:00").getTime());
  });

  it("la cuadrícula se amplía para mostrar citas fuera del horario", () => {
    expect(rangoVisible(horario, [])).toEqual({ desde: 8 * 60, hasta: 18 * 60 });
    expect(rangoVisible(horario, [{ inicioMin: 19 * 60, finMin: 19 * 60 + 30 }])).toEqual({ desde: 8 * 60, hasta: 20 * 60 });
  });
});

describe("resumen por día (vista de mes)", () => {
  it("agrupa citas por día de inicio y distingue bloqueos parciales de días completos", async () => {
    const { resumenPorDia } = await import("@/modules/agenda/vista");
    const martes = "2026-11-03";
    const resumen = resumenPorDia(
      [LUNES, martes],
      [cita("10:00", "10:30"), cita("08:00", "08:30")],
      [
        { id: "p", inicio: h("15:00"), fin: h("16:00"), dia_completo: false, motivo: "" },
        { id: "c", inicio: instante(martes), fin: instante("2026-11-04"), dia_completo: true, motivo: "Congreso" },
      ],
    );
    expect(resumen.get(LUNES)?.citas.map((c) => horaLocal(c.inicio))).toEqual(["08:00", "10:00"]);
    expect(resumen.get(LUNES)?.bloqueosParciales.map((b) => b.id)).toEqual(["p"]);
    expect(resumen.get(LUNES)?.bloqueoDiaCompleto).toBeNull();
    expect(resumen.get(martes)?.bloqueoDiaCompleto?.id).toBe("c");
    expect(resumen.get(martes)?.citas).toEqual([]);
  });
});
