import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { obtenerContenido } from "@/content";
import { contenidoDemo } from "@/content/demo/landing";
import { cerrarDb, db, pool } from "@/lib/db";
import { cargarSemillaDemo } from "@/lib/db/semilla";
import { contenidoDemoActivo, esProduccion, verificarDespliegue } from "@/lib/despliegue";
import { enlaceWhatsapp } from "@/lib/sitio";
import { listarHorarioSemanal, resumirHorario } from "@/modules/agenda/horario";
import { baseTieneContenidoDemo, leerContacto, normalizarWhatsapp } from "@/modules/configuracion";
import { formatearDuracion, formatearPrecio, listarServiciosLanding } from "@/modules/servicios";
import { limpiarDatos } from "./ayudas";

afterAll(cerrarDb);
beforeEach(() => limpiarDatos(db()));

const DESARROLLO = { APP_ENV: "development" };

describe("bloqueo de despliegue", () => {
  it("falla en producción con contenido de demostración", () => {
    expect(() => verificarDespliegue({ APP_ENV: "production", DEMO_CONTENT: "true" })).toThrow(/Despliegue bloqueado/);
    expect(() => verificarDespliegue({ RAILWAY_ENVIRONMENT_NAME: "production", DEMO_CONTENT: "true" })).toThrow();
  });

  it("permite producción sin demostración y desarrollo con demostración", () => {
    expect(() => verificarDespliegue({ APP_ENV: "production", DEMO_CONTENT: "false" })).not.toThrow();
    expect(() => verificarDespliegue({ APP_ENV: "production" })).not.toThrow();
    expect(() => verificarDespliegue({ APP_ENV: "development", DEMO_CONTENT: "true" })).not.toThrow();
  });

  it("solo 'true' exacto activa la demostración", () => {
    expect(contenidoDemoActivo({ DEMO_CONTENT: "TRUE" })).toBe(false);
    expect(esProduccion({ RAILWAY_ENVIRONMENT_NAME: "staging" })).toBe(false);
  });
});

describe("contenido", () => {
  it("sin modo demostración no sale ningún texto ficticio", () => {
    const real = JSON.stringify(obtenerContenido(false));
    for (const texto of [contenidoDemo.hero.titular, contenidoDemo.servicios.cierre, contenidoDemo.antesDespues.nota]) {
      expect(texto).toBeTruthy();
      expect(real).not.toContain(texto);
    }
    expect(obtenerContenido(false).antesDespues.casos).toEqual([]);
  });
});

describe("semilla de demostración", () => {
  it("carga servicios, horario y la marca de demostración, y se puede repetir", async () => {
    await cargarSemillaDemo(pool(), DESARROLLO);
    await cargarSemillaDemo(pool(), DESARROLLO);
    expect(await db().selectFrom("servicio").select("id").execute()).toHaveLength(14);
    expect(await db().selectFrom("horario_laboral").select("id").execute()).toHaveLength(11);
    expect(await baseTieneContenidoDemo(db())).toBe(true);
  });

  it("no siembra datos de contacto ni registro profesional", async () => {
    await cargarSemillaDemo(pool(), DESARROLLO);
    expect(Object.values(await leerContacto(db())).every((v) => v === null)).toBe(true);
  });

  it("se niega a correr en producción", async () => {
    await expect(cargarSemillaDemo(pool(), { APP_ENV: "production" })).rejects.toThrow(/producción/);
    await expect(cargarSemillaDemo(pool(), { RAILWAY_ENVIRONMENT_NAME: "production" })).rejects.toThrow();
    expect(await db().selectFrom("servicio").select("id").execute()).toHaveLength(0);
  });

  it("no pisa una base con servicios reales", async () => {
    await db().insertInto("servicio").values({ slug: "real", nombre: "Servicio real", duracion_min: 30 }).execute();
    await expect(cargarSemillaDemo(pool(), DESARROLLO)).rejects.toThrow(/no son de demostración/);
    expect(await db().selectFrom("servicio").select("slug").execute()).toEqual([{ slug: "real" }]);
  });
});

describe("servicios en la landing", () => {
  it("muestra solo activos y visibles, en orden, y el precio solo si se autorizó mostrarlo", async () => {
    await cargarSemillaDemo(pool(), DESARROLLO);
    await db().updateTable("servicio").set({ activo: false }).where("slug", "=", "carillas").execute();
    await db().updateTable("servicio").set({ visible_en_landing: false }).where("slug", "=", "coronas").execute();

    const servicios = await listarServiciosLanding(db());
    const slugs = servicios.map((s) => s.slug);
    expect(slugs).toHaveLength(12);
    expect(slugs[0]).toBe("valoracion-odontologica");
    expect(slugs).not.toContain("carillas");
    expect(slugs).not.toContain("coronas");

    const porSlug = Object.fromEntries(servicios.map((s) => [s.slug, s]));
    expect(porSlug["valoracion-odontologica"]?.precioCop).toBe(80000);
    // Tiene precio en la base pero mostrar_precio = false: no sale del servidor.
    expect(porSlug["diseno-de-sonrisa"]?.precioCop).toBeNull();
    expect(porSlug["implantes-dentales"]?.precioCop).toBeNull();
  });

  it("formatea duración y precio", () => {
    expect(formatearDuracion(30)).toBe("30 min");
    expect(formatearDuracion(60)).toBe("1 h");
    expect(formatearDuracion(90)).toBe("1 h 30 min");
    expect(formatearPrecio(80000).replace(/\s/g, " ")).toBe("$ 80.000");
  });
});

describe("contacto", () => {
  it("valida y normaliza los valores; lo inválido queda como pendiente", async () => {
    await db()
      .insertInto("configuracion")
      .values([
        { clave: "contacto_whatsapp", valor: JSON.stringify("+57 300 123 4567") },
        { clave: "contacto_correo", valor: JSON.stringify("no-es-correo") },
        { clave: "contacto_direccion", valor: JSON.stringify("   ") },
        { clave: "contacto_telefono", valor: JSON.stringify("(604) 000 0000") },
      ])
      .execute();
    expect(await leerContacto(db())).toEqual({
      direccion: null,
      ciudad: null,
      telefono: "(604) 000 0000",
      whatsapp: "573001234567",
      correo: null,
      registroProfesional: null,
    });
  });

  it("rechaza números de WhatsApp que no parecen E.164", () => {
    expect(normalizarWhatsapp("3001234567")).toBe("3001234567");
    expect(normalizarWhatsapp("123")).toBeNull();
    expect(normalizarWhatsapp("57300abc4567")).toBeNull();
    expect(normalizarWhatsapp(573001234567)).toBeNull();
  });

  it("arma el enlace de WhatsApp con el mensaje codificado", () => {
    expect(enlaceWhatsapp("573001234567", "Hola, ¿cómo?")).toBe(
      "https://wa.me/573001234567?text=Hola%2C%20%C2%BFc%C3%B3mo%3F",
    );
  });
});

describe("horario", () => {
  it("agrupa días consecutivos con el mismo horario", async () => {
    await cargarSemillaDemo(pool(), DESARROLLO);
    expect(resumirHorario(await listarHorarioSemanal(db()))).toEqual([
      { dias: "Lunes a viernes", horas: "8:00–12:00 y 14:00–18:00" },
      { dias: "Sábado", horas: "8:00–12:00" },
    ]);
  });

  it("no agrupa días con huecos ni horarios distintos", () => {
    const tramo = [{ inicio: "8:00", fin: "12:00" }];
    expect(
      resumirHorario([
        { dia: 1, tramos: tramo },
        { dia: 2, tramos: tramo },
        { dia: 4, tramos: tramo },
        { dia: 5, tramos: [{ inicio: "9:00", fin: "12:00" }] },
      ]),
    ).toEqual([
      { dias: "Lunes y martes", horas: "8:00–12:00" },
      { dias: "Jueves", horas: "8:00–12:00" },
      { dias: "Viernes", horas: "9:00–12:00" },
    ]);
  });

  it("sin horario cargado devuelve vacío (la landing muestra pendiente)", async () => {
    expect(resumirHorario(await listarHorarioSemanal(db()))).toEqual([]);
  });
});
