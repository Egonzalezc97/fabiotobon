import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { sql } from "kysely";
import sharp from "sharp";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AlmacenamientoLocal } from "@/lib/almacenamiento";
import { cerrarDb, db } from "@/lib/db";
import {
  actualizarCaso,
  archivoPrivado,
  casosPublicados,
  crearCaso,
  despublicarCaso,
  ErrorGaleria,
  publicarCaso,
  registrarConsentimientoImagen,
  subirImagen,
  varianteParaServir,
} from "@/modules/galeria";
import { crearPaciente, fusionarPacientes } from "@/modules/pacientes";
import { limpiarDatos } from "./ayudas";

const FABIO = { userId: "usuario-fabio" };
let raiz = "";
let alm: AlmacenamientoLocal;

beforeAll(async () => {
  raiz = await mkdtemp(path.join(os.tmpdir(), "fabiotobon-galeria-"));
  alm = new AlmacenamientoLocal(raiz);
});
afterAll(async () => {
  await cerrarDb();
  await rm(raiz, { recursive: true, force: true });
});
beforeEach(() => limpiarDatos(db()));

/** JPEG neutro con EXIF de cámara y GPS (como sale de un celular). */
async function fotoConGps(color: string, ancho = 1200, alto = 800) {
  return sharp({ create: { width: ancho, height: alto, channels: 3, background: color } })
    .jpeg()
    .withExif({ IFD0: { Make: "Camara", Model: "Modelo X" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "6/1 15/1 0/1" } })
    .toBuffer();
}

async function paciente(doc = "10203040") {
  return (await crearPaciente(db(), { tipoDocumento: "CC", numeroDocumento: doc, nombre: "Paciente Prueba", celular: null }, FABIO)).id;
}

async function casoBorrador(conConsentimiento: boolean) {
  const antes = await subirImagen(db(), alm, await fotoConGps("#6b7078"), FABIO);
  const despues = await subirImagen(db(), alm, await fotoConGps("#c9ccd1"), FABIO);
  const consentimiento = conConsentimiento
    ? await registrarConsentimientoImagen(db(), alm, { pacienteId: await paciente(), fechaFirma: "2026-09-01", enFisico: true, verificadoPor: "Fabio Tobón" }, FABIO)
    : null;
  const { id } = await crearCaso(
    db(),
    { procedimiento: "Blanqueamiento", descripcion: "Caso de prueba", imagenAntesId: antes.id, imagenDespuesId: despues.id, consentimientoImagenId: consentimiento?.id },
    FABIO,
  );
  return { id, antes, despues, consentimiento };
}

const archivosPublicos = async () => (await readdir(path.join(raiz, "publico")).catch(() => [] as string[])).sort();

describe("galería de antes y después", () => {
  it("al subir, el original privado queda sin EXIF ni GPS y no hay versiones públicas", async () => {
    const { id } = await subirImagen(db(), alm, await fotoConGps("#777"), FABIO);
    const fila = await db().selectFrom("imagen").selectAll().where("id", "=", id).executeTakeFirstOrThrow();
    expect(fila.clave_original).toMatch(/^privado\/originales\//);
    const original = await alm.leer(fila.clave_original);
    expect((await sharp(original!).metadata()).exif).toBeUndefined();
    expect(original!.toString("latin1")).not.toContain("Modelo X");
    expect(await archivosPublicos()).toEqual([]);
  });

  it("no publica sin consentimiento de uso de imagen, ni desde el módulo ni saltándoselo en la base", async () => {
    const { id } = await casoBorrador(false);
    await expect(publicarCaso(db(), alm, id, FABIO)).rejects.toThrow("consentimiento");
    await expect(sql`UPDATE caso_galeria SET estado = 'publicado' WHERE id = ${id}`.execute(db())).rejects.toThrow(/caso_publicado_con_consentimiento/);
    expect(await archivosPublicos()).toEqual([]);
  });

  it("publicar genera AVIF y WebP servibles; despublicar los retira y deja de servirlos", async () => {
    const { id } = await casoBorrador(true);
    expect(await archivosPublicos()).toEqual([]);
    await publicarCaso(db(), alm, id, FABIO);

    const [caso] = await casosPublicados(db());
    expect(caso?.procedimiento).toBe("Blanqueamiento");
    expect(caso?.antes.avif.split(", ")).toHaveLength(3);
    expect(caso?.antes.webp).toMatch(/^\/galeria\/[0-9a-f-]{36}-[0-9a-f]{8}-480\.webp 480w/);
    expect(JSON.stringify(caso)).not.toContain("Paciente Prueba");
    expect(await archivosPublicos()).toHaveLength(12); // 2 imágenes × 3 anchos × 2 formatos

    const archivo = caso!.antes.avif.split(" ")[0]!.replace("/galeria/", "");
    expect(await varianteParaServir(db(), archivo)).toMatchObject({ formato: "avif" });
    expect(await varianteParaServir(db(), "../privado/originales/x.jpg")).toBeNull();

    await despublicarCaso(db(), alm, id, FABIO);
    expect(await casosPublicados(db())).toEqual([]);
    expect(await varianteParaServir(db(), archivo)).toBeNull();
    expect(await archivosPublicos()).toEqual([]);
    expect(await db().selectFrom("imagen_variante").select("id").execute()).toEqual([]);
    // Los originales privados siguen ahí.
    for (const img of await db().selectFrom("imagen").select("clave_original").execute()) expect(await alm.leer(img.clave_original)).not.toBeNull();
  });

  it("dos publicaciones simultáneas dejan un solo juego de versiones y ningún archivo huérfano", async () => {
    const { id } = await casoBorrador(true);
    await Promise.all([publicarCaso(db(), alm, id, FABIO), publicarCaso(db(), alm, id, FABIO)]);
    const filas = await db().selectFrom("imagen_variante").select("clave").execute();
    expect(filas).toHaveLength(12);
    expect(await archivosPublicos()).toEqual(filas.map((f) => f.clave.replace("publico/", "")).sort());
  });

  it("con el caso publicado no se cambian imágenes ni consentimiento; los textos sí", async () => {
    const { id, antes, despues, consentimiento } = await casoBorrador(true);
    await publicarCaso(db(), alm, id, FABIO);
    const otra = await subirImagen(db(), alm, await fotoConGps("#333"), FABIO);
    const datos = { procedimiento: "Blanqueamiento", imagenAntesId: antes.id, imagenDespuesId: despues.id, consentimientoImagenId: consentimiento!.id };
    await expect(actualizarCaso(db(), id, { ...datos, imagenAntesId: otra.id }, FABIO)).rejects.toThrow("despublica");
    await expect(actualizarCaso(db(), id, { ...datos, consentimientoImagenId: null }, FABIO)).rejects.toBeInstanceOf(ErrorGaleria);
    await actualizarCaso(db(), id, { ...datos, procedimiento: "Blanqueamiento en consultorio" }, FABIO);
    expect((await casosPublicados(db()))[0]?.procedimiento).toBe("Blanqueamiento en consultorio");
  });

  it("el consentimiento exige documento o autorización en físico con quién la verificó, y no se edita", async () => {
    const pacienteId = await paciente();
    await expect(registrarConsentimientoImagen(db(), alm, { pacienteId, fechaFirma: "2026-09-01", enFisico: false }, FABIO)).rejects.toThrow("Adjunta");
    await expect(registrarConsentimientoImagen(db(), alm, { pacienteId, fechaFirma: "2026-09-01", enFisico: true, verificadoPor: " " }, FABIO)).rejects.toThrow("verificó");
    await expect(registrarConsentimientoImagen(db(), alm, { pacienteId, fechaFirma: "2999-01-01", enFisico: true, verificadoPor: "Fabio" }, FABIO)).rejects.toThrow("futura");
    await expect(
      registrarConsentimientoImagen(db(), alm, { pacienteId, fechaFirma: "2026-09-01", enFisico: false, archivo: Buffer.from("texto plano") }, FABIO),
    ).rejects.toThrow("PDF, JPEG o PNG");

    const pdf = Buffer.from("%PDF-1.7\n% documento de prueba\n");
    const { id } = await registrarConsentimientoImagen(db(), alm, { pacienteId, fechaFirma: "2026-09-01", enFisico: false, archivo: pdf }, FABIO);
    const fila = await db().selectFrom("consentimiento_imagen").selectAll().where("id", "=", id).executeTakeFirstOrThrow();
    expect(fila.archivo_clave).toMatch(/^privado\/consentimientos\/.+\.pdf$/);
    await expect(sql`UPDATE consentimiento_imagen SET notas = 'x' WHERE id = ${id}`.execute(db())).rejects.toThrow(/solo inserción/);
    await expect(sql`DELETE FROM consentimiento_imagen WHERE id = ${id}`.execute(db())).rejects.toThrow(/solo inserción/);

    // Leer el archivo privado deja registro en auditoría.
    const archivo = await archivoPrivado(db(), alm, "consentimiento", id, FABIO);
    expect(archivo?.contentType).toBe("application/pdf");
    const auditoria = await db().selectFrom("auditoria").select("accion").where("entidad_id", "=", id).execute();
    expect(auditoria.map((a) => a.accion)).toContain("archivo.leido");
  });

  it("la foto de un documento de consentimiento también se guarda sin GPS", async () => {
    const { id } = await registrarConsentimientoImagen(
      db(),
      alm,
      { pacienteId: await paciente(), fechaFirma: "2026-09-01", enFisico: false, archivo: await fotoConGps("#eee", 400, 600) },
      FABIO,
    );
    const archivo = await archivoPrivado(db(), alm, "consentimiento", id, FABIO);
    expect(archivo?.contentType).toBe("image/jpeg");
    expect((await sharp(archivo!.datos).metadata()).exif).toBeUndefined();
  });

  it("la fusión de fichas mueve los consentimientos de imagen a la ficha que queda", async () => {
    const destino = await paciente("50607080");
    const origen = await paciente("90807060");
    const { id } = await registrarConsentimientoImagen(db(), alm, { pacienteId: origen, fechaFirma: "2026-09-01", enFisico: true, verificadoPor: "Fabio" }, FABIO);
    await fusionarPacientes(db(), { destinoId: destino, origenId: origen }, FABIO);
    const fila = await db().selectFrom("consentimiento_imagen").select("paciente_id").where("id", "=", id).executeTakeFirstOrThrow();
    expect(fila.paciente_id).toBe(destino);
    // Fuera de una fusión, sigue siendo de solo inserción.
    await expect(sql`UPDATE consentimiento_imagen SET paciente_id = ${origen} WHERE id = ${id}`.execute(db())).rejects.toThrow(/solo inserción/);
  });
});
