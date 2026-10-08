import { describe, expect, it } from "vitest";
import {
  calcularCupos,
  dentroDelHorario,
  esCupoValido,
  unirTramos,
  type EntradaCupos,
  type HorarioSemanal,
} from "@/modules/agenda/disponibilidad";
import { diaSemana, fechaLocal, horaLocal, instante, lunesDeLaSemana, rangoDia, sumarDias } from "@/modules/agenda/tiempo";

// 2026-11-02 es lunes. Bogotá es UTC−5 todo el año: 08:00 local = 13:00 UTC.
const LUNES = "2026-11-02";
const h = (hora: string) => {
  const [hh = "0", mm = "0"] = hora.split(":");
  return Number(hh) * 60 + Number(mm);
};
const tramo = (desde: string, hasta: string) => ({ inicioMin: h(desde), finMin: h(hasta) });

const HORARIO: HorarioSemanal = {
  1: [tramo("08:00", "12:00"), tramo("14:00", "18:00")],
  2: [tramo("08:00", "12:00")],
  6: [tramo("08:00", "12:00")],
};

function entrada(cambios: Partial<EntradaCupos> = {}): EntradaCupos {
  return {
    desde: LUNES,
    hasta: LUNES,
    // Una semana antes, de noche: sin efecto de antelación ni de horizonte sobre el lunes.
    ahora: new Date("2026-10-27T02:00:00Z"),
    horario: HORARIO,
    ocupados: [],
    duracionMin: 30,
    parametros: { granularidadMin: 15, antelacionMin: 120, horizonteDias: 30 },
    ...cambios,
  };
}

const horas = (cupos: Date[]) => cupos.map(horaLocal);

describe("tiempo en America/Bogota", () => {
  it("convierte hora local a UTC y de vuelta", () => {
    expect(instante(LUNES, h("08:00")).toISOString()).toBe("2026-11-02T13:00:00.000Z");
    expect(horaLocal(new Date("2026-11-02T13:00:00Z"))).toBe("08:00");
    // 23:30 local del lunes ya es martes en UTC; la fecha local sigue siendo lunes.
    expect(fechaLocal(new Date("2026-11-03T04:30:00Z"))).toBe(LUNES);
  });

  it("calcula días de la semana, lunes y rangos de día", () => {
    expect(diaSemana(LUNES)).toBe(1);
    expect(diaSemana("2026-11-08")).toBe(7);
    expect(lunesDeLaSemana("2026-11-08")).toBe(LUNES);
    expect(sumarDias("2026-12-31", 1)).toBe("2027-01-01");
    const r = rangoDia(LUNES);
    expect([r.inicio.toISOString(), r.fin.toISOString()]).toEqual(["2026-11-02T05:00:00.000Z", "2026-11-03T05:00:00.000Z"]);
  });
});

describe("calcularCupos: bordes del horario", () => {
  it("el primer cupo es el inicio del tramo y el último termina justo al cierre", () => {
    const cupos = horas(calcularCupos(entrada()));
    expect(cupos[0]).toBe("08:00");
    expect(cupos).toContain("11:30");
    expect(cupos).not.toContain("11:45"); // terminaría 12:15
    expect(cupos).not.toContain("12:00");
    expect(cupos).toContain("14:00");
    expect(cupos.at(-1)).toBe("17:30");
    // 08:00–11:30 cada 15 min = 15 cupos; 14:00–17:30 = 15 cupos.
    expect(cupos).toHaveLength(30);
  });

  it("un servicio largo no cabe al final del tramo", () => {
    const cupos = horas(calcularCupos(entrada({ duracionMin: 120 })));
    expect(cupos).toEqual([
      "08:00", "08:15", "08:30", "08:45", "09:00", "09:15", "09:30", "09:45", "10:00",
      "14:00", "14:15", "14:30", "14:45", "15:00", "15:15", "15:30", "15:45", "16:00",
    ]);
  });

  it("un servicio más largo que cualquier tramo no tiene cupos", () => {
    expect(calcularCupos(entrada({ duracionMin: 300 }))).toEqual([]);
  });

  it("los tramos contiguos se unen y permiten servicios que cruzan el límite", () => {
    const horario = { 1: [tramo("08:00", "12:00"), tramo("12:00", "14:00")] };
    expect(unirTramos(horario[1])).toEqual([tramo("08:00", "14:00")]);
    expect(horas(calcularCupos(entrada({ horario, duracionMin: 60 })))).toContain("11:30");
  });

  it("respeta la granularidad aunque sea distinta de la duración", () => {
    const cupos = horas(calcularCupos(entrada({ parametros: { granularidadMin: 20, antelacionMin: 0, horizonteDias: 30 } })));
    expect(cupos.slice(0, 4)).toEqual(["08:00", "08:20", "08:40", "09:00"]);
    expect(cupos).toContain("11:20");
    expect(cupos).not.toContain("11:40"); // terminaría 12:10
  });

  it("un día sin horario no tiene cupos", () => {
    expect(calcularCupos(entrada({ desde: "2026-11-04", hasta: "2026-11-04" }))).toEqual([]);
  });
});

describe("calcularCupos: bloqueos y citas", () => {
  it("un bloqueo parcial quita solo los cupos que se cruzan", () => {
    const ocupados = [{ inicio: instante(LUNES, h("09:00")), fin: instante(LUNES, h("10:00")) }];
    const cupos = horas(calcularCupos(entrada({ ocupados })));
    expect(cupos).toContain("08:30"); // termina 09:00, contiguo
    expect(cupos).not.toContain("08:45");
    expect(cupos).not.toContain("09:30");
    expect(cupos).toContain("10:00");
  });

  it("un bloqueo de día completo deja el día sin cupos y no afecta los demás", () => {
    const { inicio, fin } = rangoDia(LUNES);
    const cupos = calcularCupos(entrada({ hasta: sumarDias(LUNES, 1), ocupados: [{ inicio, fin }] }));
    expect(cupos.every((c) => fechaLocal(c) === sumarDias(LUNES, 1))).toBe(true);
    expect(cupos.length).toBeGreaterThan(0);
  });

  it("un bloqueo de varios días cubre todos esos días", () => {
    const ocupados = [{ inicio: rangoDia(LUNES).inicio, fin: rangoDia(sumarDias(LUNES, 1)).fin }];
    expect(calcularCupos(entrada({ hasta: sumarDias(LUNES, 1), ocupados }))).toEqual([]);
  });

  it("una cita activa ocupa su rango", () => {
    const ocupados = [{ inicio: instante(LUNES, h("14:00")), fin: instante(LUNES, h("16:00")) }];
    const cupos = horas(calcularCupos(entrada({ ocupados })));
    expect(cupos).not.toContain("15:45");
    expect(cupos).toContain("16:00");
    expect(cupos).toContain("11:30");
  });
});

describe("calcularCupos: antelación y horizonte", () => {
  it("no ofrece cupos que empiecen antes de ahora + antelación (borde exacto incluido)", () => {
    // Ahora: lunes 08:30 local. Antelación 120 → desde las 10:30.
    const ahora = instante(LUNES, h("08:30"));
    const cupos = horas(calcularCupos(entrada({ ahora })));
    expect(cupos[0]).toBe("10:30");
    expect(cupos).not.toContain("10:15");
  });

  it("no ofrece días más allá del horizonte", () => {
    const ahora = instante(LUNES, h("06:00"));
    const parametros = { granularidadMin: 15, antelacionMin: 0, horizonteDias: 1 };
    const cupos = calcularCupos(entrada({ ahora, hasta: sumarDias(LUNES, 14), parametros }));
    const dias = [...new Set(cupos.map(fechaLocal))];
    expect(dias).toEqual([LUNES, sumarDias(LUNES, 1)]);
  });

  it("con horizonte 0 solo se puede reservar hoy", () => {
    const ahora = instante(LUNES, h("06:00"));
    const cupos = calcularCupos(entrada({ ahora, hasta: sumarDias(LUNES, 5), parametros: { granularidadMin: 15, antelacionMin: 0, horizonteDias: 0 } }));
    expect(new Set(cupos.map(fechaLocal))).toEqual(new Set([LUNES]));
  });
});

describe("validaciones puntuales", () => {
  it("esCupoValido acepta solo inicios ofrecidos", () => {
    const e = entrada();
    expect(esCupoValido(instante(LUNES, h("08:15")), e)).toBe(true);
    expect(esCupoValido(instante(LUNES, h("08:10")), e)).toBe(false); // fuera de la granularidad
    expect(esCupoValido(instante(LUNES, h("11:45")), e)).toBe(false); // no cabe
    expect(esCupoValido(instante(LUNES, h("13:00")), e)).toBe(false); // fuera del horario
  });

  it("dentroDelHorario detecta intervalos fuera del horario", () => {
    const dentro = { inicio: instante(LUNES, h("09:00")), fin: instante(LUNES, h("10:00")) };
    const cruzaAlmuerzo = { inicio: instante(LUNES, h("11:30")), fin: instante(LUNES, h("12:30")) };
    const miercoles = { inicio: instante("2026-11-04", h("09:00")), fin: instante("2026-11-04", h("10:00")) };
    expect(dentroDelHorario(dentro, HORARIO)).toBe(true);
    expect(dentroDelHorario(cruzaAlmuerzo, HORARIO)).toBe(false);
    expect(dentroDelHorario(miercoles, HORARIO)).toBe(false);
  });
});
