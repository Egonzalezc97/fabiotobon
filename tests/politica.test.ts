import { readFileSync } from "node:fs";
import { sql } from "kysely";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Pie } from "@/app/(public)/_secciones/pie";
import { EtiquetaAutorizacion } from "@/app/(public)/reservar/datos/etiqueta-autorizacion";
import TratamientoDeDatos from "@/app/(public)/tratamiento-de-datos/page";
import { cerrarDb, db } from "@/lib/db";
import {
  BorradorEnProduccion,
  cargarBorradoresLegales,
  evaluarPolitica,
  guardarAutorizacion,
  guardarPolitica,
  leerContacto,
  leerPolitica,
  leerTextoAutorizacion,
  listarVersionesAutorizacion,
  textoAutorizacionDesdeMarkdown,
} from "@/modules/configuracion";
import { limpiarDatos } from "./ayudas";

afterAll(cerrarDb);
beforeEach(() => limpiarDatos(db()));
afterEach(() => vi.unstubAllEnvs());

const BORRADOR = readFileSync("docs/politica-tratamiento-datos-borrador.md", "utf8");
const AUTORIZACION_MD = readFileSync("docs/autorizacion-datos-borrador.md", "utf8");
const COMPLETA = `# Política de tratamiento de datos personales

Vigente desde: 1 de noviembre de 2026

## 1. Responsable

- **Correo:** solicitudes@ejemplo.test

<script>alert(1)</script>
`;
const SISTEMA = { id: null, tipo: "sistema" } as const;

/** Renderiza la página como lo haría Next; devuelve el HTML o "404" si llama a notFound(). */
async function pagina(): Promise<string> {
  try {
    return renderToStaticMarkup(await TratamientoDeDatos());
  } catch (error) {
    if ((error as { digest?: string }).digest?.endsWith(";404")) return "404";
    throw error;
  }
}

async function enlaces() {
  const contacto = await leerContacto(db());
  const { publicable } = await leerPolitica(db());
  return {
    pie: renderToStaticMarkup(createElement(Pie, { contacto, politicaPublicada: publicable })),
    casilla: renderToStaticMarkup(createElement(EtiquetaAutorizacion, { politicaPublicada: publicable })),
  };
}

describe("publicación de la política", () => {
  it("cada marcador pendiente impide publicar; el texto completo sí se publica", () => {
    expect(evaluarPolitica(null)).toMatchObject({ publicable: false });
    expect(evaluarPolitica("   ")).toMatchObject({ publicable: false });
    expect(evaluarPolitica(BORRADOR).publicable).toBe(false);
    expect(evaluarPolitica(BORRADOR).faltantes).toHaveLength(3);
    expect(evaluarPolitica(`${COMPLETA}\nCorreo: [CORREO PARA SOLICITUDES]`).publicable).toBe(false);
    expect(evaluarPolitica(`${COMPLETA}\nVigente desde: [FECHA DE PUBLICACIÓN]`).publicable).toBe(false);
    expect(evaluarPolitica(`> BORRADOR para aprobación\n${COMPLETA}`).publicable).toBe(false);
    expect(evaluarPolitica(COMPLETA)).toMatchObject({ publicable: true, faltantes: [] });
    // La cédula ya no es un marcador (el Decreto 1377 no la exige).
    expect(evaluarPolitica(`${COMPLETA}\n[CÉDULA DE FABIO]`).publicable).toBe(true);
  });

  it("con marcadores pendientes: 404 en producción y ningún enlace a la página", async () => {
    await guardarPolitica(db(), BORRADOR, SISTEMA);
    vi.stubEnv("APP_ENV", "production");
    expect(await pagina()).toBe("404");
    const { pie, casilla } = await enlaces();
    expect(pie).not.toContain("/tratamiento-de-datos");
    expect(casilla).not.toContain("/tratamiento-de-datos");
    expect(casilla).toContain("He leído y acepto la autorización de tratamiento de datos.");
  });

  it("sin texto: 404 en producción; en desarrollo, aviso visible", async () => {
    vi.stubEnv("APP_ENV", "production");
    expect(await pagina()).toBe("404");
    vi.stubEnv("APP_ENV", "development");
    expect(await pagina()).toContain("No hay política cargada");
  });

  it("con marcadores, fuera de producción se ve con el aviso de borrador sin publicar", async () => {
    await guardarPolitica(db(), BORRADOR, SISTEMA);
    const html = await pagina();
    expect(html).toContain("Borrador sin publicar");
    expect(html).toContain("correo para solicitudes");
  });

  it("con el texto completo: la página se ve en producción, sin HTML crudo, y aparecen los enlaces", async () => {
    await guardarPolitica(db(), COMPLETA, SISTEMA);
    vi.stubEnv("APP_ENV", "production");
    const html = await pagina();
    expect(html).toContain("<h1");
    expect(html).toContain("Política de tratamiento de datos personales");
    expect(html).not.toContain("Borrador sin publicar");
    expect(html).not.toContain("<script");
    const { pie, casilla } = await enlaces();
    expect(pie).toContain('href="/tratamiento-de-datos"');
    expect(casilla).toContain('href="/tratamiento-de-datos"');
  });

  it("guardar la política deja auditoría con hash y estado, y vacía la borra", async () => {
    await guardarPolitica(db(), COMPLETA, SISTEMA);
    await guardarPolitica(db(), "", SISTEMA);
    expect((await leerPolitica(db())).texto).toBeNull();
    const eventos = await db().selectFrom("auditoria").select(["accion", "detalle"]).where("accion", "=", "politica.actualizada").execute();
    expect(eventos).toHaveLength(2);
    expect(eventos[0]?.detalle).toMatchObject({ publicable: true, caracteres: COMPLETA.trim().length });
  });
});

describe("versiones de la autorización", () => {
  const TEXTO = "Autorizo el tratamiento de mis datos personales para agendar mi cita.";
  const AHORA = new Date("2026-10-08T15:00:00Z");

  it("guardar crea una versión nueva sin tocar las anteriores; igual al vigente no crea nada", async () => {
    expect(await guardarAutorizacion(db(), { texto: TEXTO, borrador: true }, SISTEMA, AHORA)).toEqual({ version: "borrador-2026-10-08", creada: true });
    expect(await guardarAutorizacion(db(), { texto: TEXTO, borrador: true }, SISTEMA, AHORA)).toEqual({ version: "borrador-2026-10-08", creada: false });
    expect(await guardarAutorizacion(db(), { texto: `${TEXTO} Cambio.`, borrador: true }, SISTEMA, AHORA)).toEqual({
      version: "borrador-2026-10-08-2",
      creada: true,
    });
    expect(await guardarAutorizacion(db(), { texto: `${TEXTO} Cambio.`, borrador: false }, SISTEMA, AHORA)).toEqual({ version: "2026-10-08", creada: true });

    expect(await leerTextoAutorizacion(db())).toMatchObject({ version: "2026-10-08", borrador: false, demostracion: false });
    const versiones = await listarVersionesAutorizacion(db());
    expect(versiones.map((v) => v.version)).toEqual(["2026-10-08", "borrador-2026-10-08-2", "borrador-2026-10-08"]);
    expect(versiones[2]?.texto).toBe(TEXTO);
    const auditoria = await db().selectFrom("auditoria").select("accion").where("accion", "=", "autorizacion.version_creada").execute();
    expect(auditoria).toHaveLength(3);
  });

  it("la tabla de versiones es de solo inserción", async () => {
    await guardarAutorizacion(db(), { texto: TEXTO, borrador: false }, SISTEMA, AHORA);
    await expect(sql`UPDATE texto_autorizacion SET texto = 'otro texto suficientemente largo'`.execute(db())).rejects.toThrow(/solo inserción/);
    await expect(sql`DELETE FROM texto_autorizacion`.execute(db())).rejects.toThrow(/solo inserción/);
  });

  it("rechaza textos vacíos o demasiado cortos", async () => {
    await expect(guardarAutorizacion(db(), { texto: "corto", borrador: false }, SISTEMA)).rejects.toThrow(/muy corto/);
  });
});

describe("carga de borradores", () => {
  it("se niega en producción", async () => {
    await expect(
      cargarBorradoresLegales(db(), { politica: BORRADOR, autorizacionMarkdown: AUTORIZACION_MD }, { forzar: true, produccion: true }),
    ).rejects.toBeInstanceOf(BorradorEnProduccion);
    expect((await leerPolitica(db())).texto).toBeNull();
  });

  it("carga ambos textos, reemplaza el de demostración y no pisa sin --forzar", async () => {
    await db().insertInto("texto_autorizacion").values({ version: "demo-1", demostracion: true, texto: "Texto de demostración bastante largo." }).execute();
    const textos = { politica: BORRADOR, autorizacionMarkdown: AUTORIZACION_MD };

    const primera = await cargarBorradoresLegales(db(), textos, { forzar: false, produccion: false });
    expect(primera.politica).toBe("cargada");
    expect(primera.autorizacion).toMatch(/^borrador-/);
    const vigente = await leerTextoAutorizacion(db());
    expect(vigente).toMatchObject({ borrador: true, demostracion: false });
    // Sin títulos ni notas del documento: solo el texto de la casilla.
    expect(vigente?.texto.startsWith("Autorizo a Fabio Tobón Casas")).toBe(true);
    expect(vigente?.texto).not.toContain("BORRADOR");

    await guardarPolitica(db(), COMPLETA, SISTEMA);
    expect(await cargarBorradoresLegales(db(), textos, { forzar: false, produccion: false })).toEqual({ politica: "existente", autorizacion: "existente" });
    expect((await leerPolitica(db())).publicable).toBe(true);

    await cargarBorradoresLegales(db(), textos, { forzar: true, produccion: false });
    expect((await leerPolitica(db())).publicable).toBe(false);
  });

  it("del markdown de la autorización solo queda el párrafo", () => {
    expect(textoAutorizacionDesdeMarkdown("# Título\n\n> nota\n> otra\n\nAutorizo esto.\n")).toBe("Autorizo esto.");
  });
});
