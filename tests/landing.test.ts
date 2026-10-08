import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { Contacto } from "@/app/(public)/_secciones/contacto";
import { Pie } from "@/app/(public)/_secciones/pie";
import { obtenerContenido } from "@/content";
import { cerrarDb, db } from "@/lib/db";
import { guardarContacto, leerContacto, type EntradaContacto } from "@/modules/configuracion";
import { limpiarDatos } from "./ayudas";

afterAll(cerrarDb);
beforeEach(() => limpiarDatos(db()));

const VACIO: EntradaContacto = {
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

async function renderizar() {
  const contacto = await leerContacto(db());
  const contenido = obtenerContenido(false).contacto;
  return {
    contacto: renderToStaticMarkup(createElement(Contacto, { contenido, contacto, horario: [] })),
    pie: renderToStaticMarkup(createElement(Pie, { contacto })),
  };
}

describe("contacto y pie", () => {
  it("con los datos reales muestra teléfono legible, redes con usuario, urgencias y especialidad", async () => {
    const { contacto, pie } = await renderizar();
    expect(contacto).toContain('href="tel:+573233456845"');
    expect(contacto).toContain(">+57 323 345 6845</a>");
    expect(contacto).toContain('aria-label="Instagram de Fabio Tobón"');
    expect(contacto).toContain("@dr.fabiotobon");
    expect(contacto).toContain("Llamar ahora");
    expect(contacto).toContain("Sobre la avenida Santander, al lado de Coldeportes");
    expect(pie).toContain("Odontología integral");
    expect(pie).not.toContain("PENDIENTE");
  });

  it("los opcionales vacíos no dejan títulos, guiones, marcadores ni íconos sin enlace", async () => {
    await guardarContacto(db(), { ...VACIO, direccion: "Carrera 23 N.º 47-80", ciudad: "Manizales", whatsapp: "+57 323 345 6845" }, "fabio");
    const { contacto, pie } = await renderizar();
    for (const html of [contacto, pie]) {
      for (const ausente of ["Teléfono", "Correo", "Redes", "Registro profesional", "Urgencias", "tel:", "mailto:", "instagram", "facebook", "Próximamente", "—"]) {
        expect(html).not.toContain(ausente);
      }
    }
    expect(contacto).not.toContain("PENDIENTE: teléfono");
    expect(contacto).toContain("Carrera 23 N.º 47-80");
    expect(pie).not.toContain("Odontología integral");
  });
});
