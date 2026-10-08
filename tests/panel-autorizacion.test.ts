import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Garantía estructural: ninguna página ni acción del panel puede quedar sin verificar al admin.
// Next renderiza layout y página en paralelo y las acciones de servidor son endpoints públicos:
// cada una debe llamar a requerirAdmin() por su cuenta.

const RAIZ = path.resolve("src/app/(admin)/admin");

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = path.join(dir, nombre);
    return statSync(ruta).isDirectory() ? archivos(ruta) : [ruta];
  });
}

const todos = archivos(RAIZ);
const relativo = (r: string) => path.relative(RAIZ, r).replaceAll("\\", "/");

describe("autorización obligatoria en el panel", () => {
  const paginas = todos.filter((r) => /(page|layout)\.tsx$/.test(r));
  it("hay páginas que revisar", () => expect(paginas.length).toBeGreaterThan(10));

  for (const ruta of paginas) {
    it(`${relativo(ruta)} llama a requerirAdmin()`, () => {
      expect(readFileSync(ruta, "utf8")).toMatch(/await requerirAdmin\(\)/);
    });
  }

  const acciones = todos.filter((r) => /\.tsx?$/.test(r) && /^\s*["']use server["']/.test(readFileSync(r, "utf8")));
  it("hay archivos de acciones que revisar", () => expect(acciones.length).toBeGreaterThanOrEqual(6));

  for (const ruta of acciones) {
    const fuente = readFileSync(ruta, "utf8");
    const funciones = [...fuente.matchAll(/export async function (\w+)\s*\(/g)];
    for (const [i, f] of funciones.entries()) {
      it(`${relativo(ruta)} · ${f[1]} llama a requerirAdmin() antes de todo`, () => {
        const cuerpo = fuente.slice(f.index, funciones[i + 1]?.index ?? fuente.length);
        const primeraLinea = cuerpo.split("{").slice(1).join("{").trim().split("\n")[0] ?? "";
        expect(primeraLinea).toMatch(/await requerirAdmin\(\)/);
      });
    }
  }
});
