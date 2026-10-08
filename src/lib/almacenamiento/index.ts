import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

/**
 * Almacenamiento de archivos subidos (originales privados, documentos de consentimiento y versiones públicas).
 * Interfaz propia: hoy disco local; la implementación S3 se escribe en el paso de despliegue.
 * Nada de lo que se guarda aquí se sirve directamente: siempre pasa por una ruta que verifica permisos.
 */
export interface Almacenamiento {
  guardar(clave: string, datos: Buffer): Promise<void>;
  /** null si no existe. */
  leer(clave: string): Promise<Buffer | null>;
  /** No falla si no existe. */
  borrar(clave: string): Promise<void>;
}

/** Claves: minúsculas, dígitos, "/", "_", "-" y "."; sin segmentos vacíos ni "..". */
const FORMATO_CLAVE = /^[a-z0-9_-]+(\/[a-z0-9_-]+)*(\.[a-z0-9]+)?$/;

export function validarClave(clave: string): string {
  if (!FORMATO_CLAVE.test(clave) || clave.length > 200) throw new Error(`Clave de almacenamiento inválida: ${clave}`);
  return clave;
}

export class AlmacenamientoLocal implements Almacenamiento {
  private readonly raiz: string;

  constructor(raiz: string) {
    this.raiz = path.resolve(raiz);
  }

  private ruta(clave: string): string {
    const ruta = path.resolve(this.raiz, validarClave(clave));
    // Defensa adicional: la ruta resuelta debe quedar dentro de la raíz.
    if (!ruta.startsWith(this.raiz + path.sep)) throw new Error(`Clave fuera del almacenamiento: ${clave}`);
    return ruta;
  }

  async guardar(clave: string, datos: Buffer): Promise<void> {
    const destino = this.ruta(clave);
    await mkdir(path.dirname(destino), { recursive: true });
    // Escritura atómica: nadie lee un archivo a medio escribir.
    const temporal = `${destino}.${randomUUID()}.tmp`;
    await writeFile(temporal, datos, { flag: "wx" });
    await rename(temporal, destino);
  }

  async leer(clave: string): Promise<Buffer | null> {
    try {
      return await readFile(this.ruta(clave));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async borrar(clave: string): Promise<void> {
    await rm(this.ruta(clave), { force: true });
  }
}

let instancia: Almacenamiento | undefined;

/** Almacenamiento configurado. ALMACENAMIENTO_DIR (por defecto ./almacenamiento, fuera de public/ e ignorado por git). */
export function almacenamiento(): Almacenamiento {
  instancia ??= new AlmacenamientoLocal(process.env.ALMACENAMIENTO_DIR || path.join(process.cwd(), "almacenamiento"));
  return instancia;
}

/** Solo para pruebas. */
export function usarAlmacenamiento(otro: Almacenamiento | undefined) {
  instancia = otro;
}
