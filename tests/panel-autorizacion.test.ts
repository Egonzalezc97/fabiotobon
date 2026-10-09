import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Garantía estructural: ninguna página, acción ni ruta de API del panel queda sin verificar sesión
// y ROL (el segundo factor es opcional desde el 2026-10-08). Next renderiza layout y página en paralelo y las acciones de servidor y las rutas
// de API son endpoints públicos: cada una debe llamar a requerirPanel() o requerirAdmin() por su cuenta.
//
// El mapa dice qué exige cada sección. Una sección nueva que no esté aquí hace fallar la prueba.
// "panel" = admin o asistente (requerirPanel; requerirAdmin también vale para acciones más estrictas).
// "admin" = solo administradores (requerirAdmin, nunca requerirPanel).
const MAPA: Record<string, "panel" | "admin"> = {
  "": "panel",
  agenda: "panel",
  citas: "panel",
  "por-revisar": "panel",
  bloqueos: "panel",
  pacientes: "panel",
  tratamientos: "panel",
  cuenta: "panel", // Mi cuenta: cada quien la suya
  usuarios: "admin",
  configuracion: "admin",
  servicios: "admin", // DPF: hoy solo admin
  horario: "admin", // DPF: hoy solo admin
  galeria: "admin",
  archivos: "admin",
};

const RAIZ_PANEL = path.resolve("src/app/(admin)/admin");
const RAIZ_API = path.resolve("src/app/api/panel");

function archivos(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = path.join(dir, nombre);
    return statSync(ruta).isDirectory() ? archivos(ruta) : [ruta];
  });
}

function seccion(raiz: string, ruta: string): string {
  const relativo = path.relative(raiz, ruta).replaceAll("\\", "/");
  return relativo.includes("/") ? relativo.split("/")[0]! : "";
}

const relativo = (r: string) => path.relative(process.cwd(), r).replaceAll("\\", "/");
const LLAMADA = /await (requerirPanel|requerirAdmin)\(\)/;

function verificarLlamada(texto: string, exigido: "panel" | "admin") {
  const llamada = LLAMADA.exec(texto)?.[1];
  expect(llamada, "debe llamar a requerirPanel() o requerirAdmin()").toBeDefined();
  if (exigido === "admin") expect(llamada).toBe("requerirAdmin");
}

/** Cuerpo de cada función exportada (acciones y manejadores de rutas). */
function funcionesExportadas(fuente: string) {
  const encontradas = [...fuente.matchAll(/export (?:async )?function (\w+)\s*\(/g)];
  return encontradas.map((f, i) => {
    const cuerpo = fuente.slice(f.index, encontradas[i + 1]?.index ?? fuente.length);
    const primeraLinea = cuerpo.split("{").slice(1).join("{").trim().split("\n")[0] ?? "";
    return { nombre: f[1]!, primeraLinea };
  });
}

const panel = archivos(RAIZ_PANEL);
const api = archivos(RAIZ_API);

describe("mapa de roles del panel", () => {
  it("todas las secciones del panel y de la API están en el mapa", () => {
    const desconocidas = [
      ...panel.map((r) => seccion(RAIZ_PANEL, r)),
      ...api.map((r) => seccion(RAIZ_API, r) || path.basename(path.dirname(r))),
    ].filter((s) => !(s in MAPA));
    expect([...new Set(desconocidas)]).toEqual([]);
  });

  const paginas = panel.filter((r) => /(page|layout)\.tsx$/.test(r));
  it("hay páginas que revisar", () => expect(paginas.length).toBeGreaterThan(15));

  for (const ruta of paginas) {
    const exigido = MAPA[seccion(RAIZ_PANEL, ruta)] ?? "admin";
    it(`${relativo(ruta)} exige rol ${exigido}`, () => verificarLlamada(readFileSync(ruta, "utf8"), exigido));
  }

  const acciones = panel.filter((r) => /\.tsx?$/.test(r) && /^\s*["']use server["']/.test(readFileSync(r, "utf8")));
  it("hay archivos de acciones que revisar", () => expect(acciones.length).toBeGreaterThanOrEqual(7));

  for (const ruta of acciones) {
    const exigido = MAPA[seccion(RAIZ_PANEL, ruta)] ?? "admin";
    for (const f of funcionesExportadas(readFileSync(ruta, "utf8"))) {
      it(`${relativo(ruta)} · ${f.nombre} exige rol ${exigido} antes de todo`, () => {
        expect(f.primeraLinea).toMatch(LLAMADA);
        if (exigido === "admin") expect(f.primeraLinea).toMatch(/requerirAdmin/);
      });
    }
  }

  const rutasApi = api.filter((r) => /route\.ts$/.test(r));
  for (const ruta of rutasApi) {
    const nombreSeccion = seccion(RAIZ_API, ruta) || path.basename(path.dirname(ruta));
    const exigido = MAPA[nombreSeccion] ?? "admin";
    for (const f of funcionesExportadas(readFileSync(ruta, "utf8"))) {
      it(`${relativo(ruta)} · ${f.nombre} exige rol ${exigido} antes de todo`, () => {
        expect(f.primeraLinea).toMatch(LLAMADA);
        if (exigido === "admin") expect(f.primeraLinea).toMatch(/requerirAdmin/);
      });
    }
  }
});
