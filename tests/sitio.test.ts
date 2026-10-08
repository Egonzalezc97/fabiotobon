import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { marcadoresVisibles } from "@/components/publico/pendiente";
import { obtenerContenido } from "@/content";
import { contenidoDemo } from "@/content/demo/landing";
import { cerrarDb, db, pool } from "@/lib/db";
import { cargarSemillaDemo } from "@/lib/db/semilla";
import { contenidoDemoActivo, esProduccion, verificarDespliegue } from "@/lib/despliegue";
import { listarHorarioSemanal, resumirHorario } from "@/modules/agenda/horario";
import {
  baseTieneContenidoDemo,
  ContactoInvalido,
  enlaceComoLlegar,
  enlaceWhatsapp,
  guardarContacto,
  leerContacto,
  normalizarRed,
  normalizarWhatsapp,
  usuarioDeRed,
} from "@/modules/configuracion";
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

  it("no siembra datos de contacto ni registro profesional (los reales vienen de la migración o del panel)", async () => {
    const antes = await leerContacto(db());
    await cargarSemillaDemo(pool(), DESARROLLO);
    expect(await leerContacto(db())).toEqual(antes);
    expect(antes).toMatchObject({ correo: null, registroProfesional: null });
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
  it("la migración deja el WhatsApp real de Fabio y el mensaje inicial, con enlace activo", async () => {
    const contacto = await leerContacto(db());
    expect(contacto.whatsapp).toBe("573233456845");
    expect(contacto.mensajeWhatsapp).toBe("Hola, quiero información para agendar una valoración.");
    expect(contacto.enlaceWhatsapp).toBe(
      "https://wa.me/573233456845?text=Hola%2C%20quiero%20informaci%C3%B3n%20para%20agendar%20una%20valoraci%C3%B3n.",
    );
  });

  it("la migración deja especialidad, dirección, referencia, redes y urgencias reales", async () => {
    expect(await leerContacto(db())).toMatchObject({
      especialidad: "Odontología integral",
      telefono: "+57 323 345 6845",
      enlaceTelefono: "tel:+573233456845",
      direccion: "Carrera 23 N.º 47-80",
      ciudad: "Manizales",
      referencia: "Sobre la avenida Santander, al lado de Coldeportes",
      instagram: "https://instagram.com/dr.fabiotobon",
      facebook: "https://facebook.com/dr.fabiotobon",
      enlaceComoLlegar: "https://www.google.com/maps/search/?api=1&query=Carrera+23+47-80+Manizales",
      urgencias: { texto: "Urgencias 24 horas", telefono: "+57 323 345 6845", enlace: "tel:+573233456845" },
    });
  });

  it("valida y normaliza los valores; lo inválido queda como pendiente", async () => {
    await db()
      .deleteFrom("configuracion")
      .where((eb) => eb.or([eb("clave", "like", "contacto%"), eb("clave", "like", "redes%"), eb("clave", "like", "urgencias%"), eb("clave", "=", "especialidad")]))
      .execute();
    await db()
      .insertInto("configuracion")
      .values([
        { clave: "contacto_whatsapp", valor: JSON.stringify("+57 300 123 4567") },
        { clave: "contacto_correo", valor: JSON.stringify("no-es-correo") },
        { clave: "contacto_direccion", valor: JSON.stringify("   ") },
        { clave: "contacto_telefono", valor: JSON.stringify("(604) 000 0000") },
        { clave: "redes_instagram", valor: JSON.stringify("https://otro-sitio.com/dr.fabiotobon") },
        { clave: "urgencias_activa", valor: JSON.stringify(true) },
        { clave: "urgencias_telefono", valor: JSON.stringify("123") },
      ])
      .execute();
    expect(await leerContacto(db())).toEqual({
      especialidad: null,
      direccion: null,
      ciudad: null,
      referencia: null,
      telefono: "(604) 000 0000",
      whatsapp: "573001234567",
      mensajeWhatsapp: null,
      correo: null,
      registroProfesional: null,
      instagram: null,
      facebook: null,
      urgenciasActiva: true,
      urgenciasTexto: null,
      urgenciasTelefono: null,
      enlaceWhatsapp: "https://wa.me/573001234567",
      enlaceComoLlegar: null,
      // Un fijo escrito con indicativo de área también se puede llamar.
      enlaceTelefono: "tel:+576040000000",
      // Activa pero sin texto ni número válidos: no se muestra.
      urgencias: null,
    });
  });

  it("rechaza números de WhatsApp que no parecen E.164", () => {
    expect(normalizarWhatsapp("3001234567")).toBe("3001234567");
    expect(normalizarWhatsapp("123")).toBeNull();
    expect(normalizarWhatsapp("57300abc4567")).toBeNull();
    expect(normalizarWhatsapp(573001234567)).toBeNull();
  });

  it("el panel guarda, valida y borra datos de contacto, y deja auditoría", async () => {
    const vacio = {
      especialidad: "",
      direccion: "",
      ciudad: "",
      referencia: "",
      telefono: "",
      whatsapp: "",
      mensajeWhatsapp: "",
      correo: "",
      registroProfesional: "",
      instagram: "",
      facebook: "",
      urgenciasActiva: false,
      urgenciasTexto: "",
      urgenciasTelefono: "",
    };
    await guardarContacto(db(), { ...vacio, whatsapp: "+57 323 345 6845", mensajeWhatsapp: "Hola", ciudad: "Ciudad de prueba" }, "fabio");
    expect(await leerContacto(db())).toMatchObject({
      whatsapp: "573233456845",
      ciudad: "Ciudad de prueba",
      enlaceWhatsapp: "https://wa.me/573233456845?text=Hola",
    });
    await expect(guardarContacto(db(), { ...vacio, whatsapp: "323 345" }, "fabio")).rejects.toBeInstanceOf(ContactoInvalido);
    await expect(guardarContacto(db(), { ...vacio, correo: "x@" }, "fabio")).rejects.toBeInstanceOf(ContactoInvalido);
    // Vaciar un campo lo borra: la web vuelve a mostrar "[PENDIENTE: …]".
    await guardarContacto(db(), vacio, "fabio");
    expect(await leerContacto(db())).toMatchObject({ whatsapp: null, enlaceWhatsapp: null, ciudad: null, especialidad: null, urgencias: null });
    const auditoria = await db().selectFrom("auditoria").select("accion").where("accion", "=", "contacto.actualizado").execute();
    expect(auditoria).toHaveLength(2);
  });

  it("guarda redes y urgencias normalizadas, y no activa urgencias sin número", async () => {
    const base = {
      especialidad: "Odontología integral",
      direccion: "Carrera 23 N.º 47-80",
      ciudad: "Manizales",
      referencia: "Al lado de Coldeportes",
      telefono: "",
      whatsapp: "",
      mensajeWhatsapp: "",
      correo: "",
      registroProfesional: "",
      instagram: "@dr.fabiotobon",
      facebook: "https://www.facebook.com/dr.fabiotobon/",
      urgenciasActiva: true,
      urgenciasTexto: "Urgencias 24 horas",
      urgenciasTelefono: "323 345 6845",
    };
    await guardarContacto(db(), base, "fabio");
    expect(await leerContacto(db())).toMatchObject({
      instagram: "https://instagram.com/dr.fabiotobon",
      facebook: "https://facebook.com/dr.fabiotobon",
      urgenciasTelefono: "+573233456845",
      urgencias: { enlace: "tel:+573233456845" },
    });
    await expect(guardarContacto(db(), { ...base, urgenciasTelefono: "" }, "fabio")).rejects.toBeInstanceOf(ContactoInvalido);
    await expect(guardarContacto(db(), { ...base, instagram: "https://evil.example/x" }, "fabio")).rejects.toBeInstanceOf(ContactoInvalido);
    await expect(guardarContacto(db(), { ...base, especialidad: "x".repeat(61) }, "fabio")).rejects.toBeInstanceOf(ContactoInvalido);
    // Apagada: se guarda el número pero la franja no sale.
    await guardarContacto(db(), { ...base, urgenciasActiva: false }, "fabio");
    expect(await leerContacto(db())).toMatchObject({ urgenciasActiva: false, urgenciasTelefono: "+573233456845", urgencias: null });
  });

  it("arma el enlace de Cómo llegar sin N.º ni #", () => {
    expect(enlaceComoLlegar("Carrera 23 N.º 47-80", "Manizales")).toBe(
      "https://www.google.com/maps/search/?api=1&query=Carrera+23+47-80+Manizales",
    );
    expect(enlaceComoLlegar("Calle 10 # 5-20")).toBe("https://www.google.com/maps/search/?api=1&query=Calle+10+5-20");
    expect(enlaceComoLlegar("Avenida Norte No. 4")).toBe("https://www.google.com/maps/search/?api=1&query=Avenida+Norte+4");
  });

  it("toma el usuario de la URL de la red", () => {
    expect(usuarioDeRed("https://instagram.com/dr.fabiotobon")).toBe("@dr.fabiotobon");
    expect(usuarioDeRed("https://facebook.com/dr.fabiotobon")).toBe("@dr.fabiotobon");
  });

  it("los marcadores de pendiente solo se ven fuera de producción o con DEMO_CONTENT", () => {
    expect(marcadoresVisibles({ APP_ENV: "development" })).toBe(true);
    expect(marcadoresVisibles({ APP_ENV: "production" })).toBe(false);
    expect(marcadoresVisibles({ RAILWAY_ENVIRONMENT_NAME: "production" })).toBe(false);
    expect(marcadoresVisibles({ APP_ENV: "production", DEMO_CONTENT: "true" })).toBe(true);
  });

  it("acepta redes solo de su dominio oficial", () => {
    expect(normalizarRed("dr.fabiotobon", "instagram")).toBe("https://instagram.com/dr.fabiotobon");
    expect(normalizarRed("https://www.instagram.com/dr.fabiotobon/", "instagram")).toBe("https://instagram.com/dr.fabiotobon");
    expect(normalizarRed("http://instagram.com/dr.fabiotobon", "instagram")).toBeNull();
    expect(normalizarRed("https://instagram.com.evil.example/x", "instagram")).toBeNull();
    expect(normalizarRed("https://instagram.com/", "instagram")).toBeNull();
    expect(normalizarRed("https://facebook.com/dr.fabiotobon", "instagram")).toBeNull();
  });

  it("arma el enlace de WhatsApp con el mensaje codificado", () => {
    expect(enlaceWhatsapp("573001234567")).toBe("https://wa.me/573001234567");
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
