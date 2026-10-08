import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterAll, describe, expect, it } from "vitest";
import { AlmacenamientoLocal } from "@/lib/almacenamiento";
import { detectarFormato, generarVariantes, ImagenInvalida, procesarOriginal, TAMANO_MAXIMO } from "@/lib/imagenes";

/** JPEG 400×200 con EXIF de cámara, GPS y orientación 6 (girada 90°). */
async function jpegConMetadatos(ancho = 400, alto = 200) {
  return sharp({ create: { width: ancho, height: alto, channels: 3, background: "#8a8f96" } })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .withExifMerge({
      IFD0: { Make: "Camara", Model: "Modelo X" },
      IFD3: { GPSLatitudeRef: "N", GPSLatitude: "6/1 15/1 0/1", GPSLongitudeRef: "W", GPSLongitude: "75/1 34/1 0/1" },
    })
    .toBuffer();
}

describe("procesamiento de imágenes", () => {
  it("quita EXIF y GPS del original y aplica la orientación", async () => {
    const entrada = await jpegConMetadatos();
    const antes = await sharp(entrada).metadata();
    expect(antes.exif).toBeDefined();
    expect(antes.orientation).toBe(6);
    // La entrada sí trae el puntero al bloque GPS (etiqueta 0x8825), para que la prueba no pase en vacío.
    const gps = (e: Buffer) => e.includes(Buffer.from([0x88, 0x25])) || e.includes(Buffer.from([0x25, 0x88]));
    expect(gps(antes.exif!)).toBe(true);

    const original = await procesarOriginal(entrada);
    const meta = await sharp(original.datos).metadata();
    expect(original.formato).toBe("jpeg");
    expect(meta.exif).toBeUndefined();
    expect(meta.xmp).toBeUndefined();
    expect(meta.iptc).toBeUndefined();
    expect(meta.orientation).toBeUndefined();
    // Orientación 6: la imagen queda vertical.
    expect([original.ancho, original.alto]).toEqual([200, 400]);
    expect(original.datos.toString("latin1")).not.toContain("Modelo X");
    expect(original.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("conserva PNG sin pérdida y convierte WebP a JPEG", async () => {
    const png = await sharp({ create: { width: 50, height: 50, channels: 4, background: "#ffffff00" } }).png().toBuffer();
    expect((await procesarOriginal(png)).formato).toBe("png");
    const webp = await sharp({ create: { width: 50, height: 50, channels: 3, background: "#333" } }).webp().toBuffer();
    expect((await procesarOriginal(webp)).formato).toBe("jpeg");
  });

  it("rechaza HEIC con un mensaje que explica qué hacer", async () => {
    const heic = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypheic", "latin1"), Buffer.alloc(4), Buffer.from("mif1heic", "latin1"), Buffer.alloc(64)]);
    expect(detectarFormato(heic)).toBe("heic");
    await expect(procesarOriginal(heic)).rejects.toThrow(/HEIC/);
  });

  it("distingue AVIF (marca mif1 con avif compatible) de HEIC y lo rechaza como formato no admitido", async () => {
    const avif = await sharp({ create: { width: 20, height: 20, channels: 3, background: "#555" } }).avif().toBuffer();
    expect(detectarFormato(avif)).toBe("avif");
    await expect(procesarOriginal(avif)).rejects.toThrow("Formato no admitido");
  });

  it("rechaza archivos vacíos, dañados, de otro tipo o de más de 15 MB", async () => {
    await expect(procesarOriginal(Buffer.alloc(0))).rejects.toBeInstanceOf(ImagenInvalida);
    await expect(procesarOriginal(Buffer.from("%PDF-1.7 hola"))).rejects.toThrow("Formato no admitido");
    await expect(procesarOriginal(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(100)]))).rejects.toThrow("dañada");
    await expect(procesarOriginal(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(TAMANO_MAXIMO)]))).rejects.toThrow("15 MB");
  });

  it("genera AVIF y WebP en 480, 960 y 1440 sin ampliar ni metadatos", async () => {
    const grande = await procesarOriginal(await jpegConMetadatos(1000, 1600)); // queda 1600×1000 tras rotar
    const variantes = await generarVariantes(grande.datos);
    expect(variantes.map((v) => `${v.formato}-${v.ancho}`).sort()).toEqual(["avif-1440", "avif-480", "avif-960", "webp-1440", "webp-480", "webp-960"]);
    for (const v of variantes) {
      const meta = await sharp(v.datos).metadata();
      expect(meta.exif).toBeUndefined();
      expect(v.alto).toBe(Math.round((v.ancho * 1000) / 1600));
    }
    const pequena = await procesarOriginal(await sharp({ create: { width: 300, height: 300, channels: 3, background: "#777" } }).jpeg().toBuffer());
    expect((await generarVariantes(pequena.datos)).map((v) => v.ancho)).toEqual([300, 300]);
  });
});

describe("almacenamiento local", () => {
  let raiz = "";
  afterAll(async () => {
    if (raiz) await rm(raiz, { recursive: true, force: true });
  });

  it("guarda, lee y borra; no sale de su carpeta", async () => {
    raiz = await mkdtemp(path.join(os.tmpdir(), "fabiotobon-almacen-"));
    const a = new AlmacenamientoLocal(raiz);
    await a.guardar("privado/originales/abc.jpg", Buffer.from("hola"));
    expect((await a.leer("privado/originales/abc.jpg"))?.toString()).toBe("hola");
    await a.borrar("privado/originales/abc.jpg");
    expect(await a.leer("privado/originales/abc.jpg")).toBeNull();
    await a.borrar("privado/originales/no-existe.jpg");
    for (const clave of ["../fuera.txt", "privado/../../fuera", "/absoluta", "privado//doble", "Mayus.jpg", "a\\b"]) {
      await expect(a.guardar(clave, Buffer.from("x"))).rejects.toThrow(/inválida|fuera/);
    }
  });
});
