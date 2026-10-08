import { createHash } from "node:crypto";
import sharp from "sharp";

/**
 * Procesamiento de imágenes de la galería.
 * - Entrada: JPEG, PNG o WebP de hasta 15 MB. El formato se identifica por los bytes, no por lo que dice el navegador.
 * - Original: se endereza según la orientación EXIF y se recodifica a máxima calidad SIN metadatos (EXIF, GPS, XMP, IPTC).
 * - Versiones públicas: AVIF y WebP en 480, 960 y 1440 px de ancho (sin ampliar), también sin metadatos.
 */

export const TAMANO_MAXIMO = 15 * 1024 * 1024;
export const ANCHOS = [480, 960, 1440] as const;
/** 50 megapíxeles: suficiente para cualquier cámara de celular; frena imágenes diseñadas para agotar memoria. */
const PIXELES_MAXIMOS = 50_000_000;

export class ImagenInvalida extends Error {}

const MENSAJE_HEIC =
  "Esta foto está en formato HEIC (iPhone). Súbela desde el iPhone con el botón de esta página, que la convierte a JPEG, o expórtala como JPEG.";

type FormatoEntrada = "jpeg" | "png" | "webp";

/** Identifica el formato por la firma del archivo. */
export function detectarFormato(datos: Buffer): FormatoEntrada | "heic" | "avif" | null {
  if (datos.length >= 3 && datos[0] === 0xff && datos[1] === 0xd8 && datos[2] === 0xff) return "jpeg";
  if (datos.length >= 8 && datos.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (datos.length >= 12 && datos.toString("latin1", 0, 4) === "RIFF" && datos.toString("latin1", 8, 12) === "WEBP") return "webp";
  if (datos.length >= 12 && datos.toString("latin1", 4, 8) === "ftyp") {
    // Caja ftyp: marca principal (8..12) y marcas compatibles (16..fin de la caja).
    const fin = Math.min(datos.readUInt32BE(0), datos.length, 256);
    const marcas = [datos.toString("latin1", 8, 12)];
    for (let i = 16; i + 4 <= fin; i += 4) marcas.push(datos.toString("latin1", i, i + 4));
    if (marcas.some((m) => m === "avif" || m === "avis")) return "avif";
    if (marcas.some((m) => ["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"].includes(m))) return "heic";
  }
  return null;
}

export type Original = { datos: Buffer; formato: "jpeg" | "png"; ancho: number; alto: number; sha256: string };

/** Valida y limpia una imagen subida. Lanza ImagenInvalida con un mensaje para mostrar. */
export async function procesarOriginal(datos: Buffer): Promise<Original> {
  if (datos.length === 0) throw new ImagenInvalida("El archivo está vacío.");
  if (datos.length > TAMANO_MAXIMO) throw new ImagenInvalida("La imagen supera 15 MB. Redúcela o expórtala con menor resolución.");
  const formato = detectarFormato(datos);
  if (formato === "heic") throw new ImagenInvalida(MENSAJE_HEIC);
  if (formato !== "jpeg" && formato !== "png" && formato !== "webp") throw new ImagenInvalida("Formato no admitido. Sube una imagen JPEG, PNG o WebP.");

  try {
    const entrada = sharp(datos, { limitInputPixels: PIXELES_MAXIMOS, failOn: "error" }).rotate();
    // PNG se conserva sin pérdida; JPEG y WebP pasan a JPEG de máxima calidad sin submuestreo de color.
    const salida =
      formato === "png"
        ? entrada.png({ compressionLevel: 9 })
        : entrada.flatten({ background: "#ffffff" }).jpeg({ quality: 100, chromaSubsampling: "4:4:4", mozjpeg: false });
    const { data, info } = await salida.toBuffer({ resolveWithObject: true });
    return {
      datos: data,
      formato: formato === "png" ? "png" : "jpeg",
      ancho: info.width,
      alto: info.height,
      sha256: createHash("sha256").update(data).digest("hex"),
    };
  } catch (error) {
    if (error instanceof Error && /pixel limit/i.test(error.message)) throw new ImagenInvalida("La imagen tiene demasiados píxeles. Redúcela a menos de 50 megapíxeles.");
    throw new ImagenInvalida("No se pudo leer la imagen. Puede estar dañada.");
  }
}

export type Variante = { datos: Buffer; formato: "avif" | "webp"; ancho: number; alto: number };

/** Versiones públicas de un original ya limpio. Nunca amplía: si la imagen es angosta, sale una sola versión por formato. */
export async function generarVariantes(original: Buffer): Promise<Variante[]> {
  const { width } = await sharp(original).metadata();
  if (!width) throw new ImagenInvalida("No se pudo leer la imagen.");
  const anchos = [...new Set(ANCHOS.map((a) => Math.min(a, width)))];
  const variantes: Variante[] = [];
  for (const ancho of anchos) {
    const base = sharp(original).resize({ width: ancho, withoutEnlargement: true });
    for (const formato of ["avif", "webp"] as const) {
      const proceso = formato === "avif" ? base.clone().avif({ quality: 60, effort: 4 }) : base.clone().webp({ quality: 80 });
      const { data, info } = await proceso.toBuffer({ resolveWithObject: true });
      variantes.push({ datos: data, formato, ancho: info.width, alto: info.height });
    }
  }
  return variantes;
}
