import { randomBytes, randomUUID } from "node:crypto";
import type { Almacenamiento } from "@/lib/almacenamiento";
import type { BaseDeDatos } from "@/lib/db";
import { detectarFormato, generarVariantes, ImagenInvalida, procesarOriginal, TAMANO_MAXIMO } from "@/lib/imagenes";
import { registrar } from "@/modules/auditoria";

// Galería de antes y después. Reglas:
// - Los originales (sin metadatos) y los documentos de consentimiento viven en almacenamiento PRIVADO.
// - Las versiones públicas existen solo mientras el caso está publicado; al despublicar se borran.
// - No se publica sin consentimiento de uso de imagen (también lo exige la base: caso_publicado_con_consentimiento).

export type Actor = { userId: string };

export class ErrorGaleria extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ErrorGaleria";
  }
}

const EXTENSION = { jpeg: "jpg", png: "png", "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" } as const;
const claveOriginal = (id: string, formato: "jpeg" | "png") => `privado/originales/${id}.${EXTENSION[formato]}`;
// El token cambia en cada publicación: dos publicaciones simultáneas nunca escriben el mismo archivo y una URL
// de una publicación anterior no vuelve a servir tras despublicar y publicar de nuevo.
const claveVariante = (imagenId: string, token: string, ancho: number, formato: "avif" | "webp") =>
  `publico/${imagenId}-${token}-${ancho}.${formato}`;

/** Nombre público de una variante (lo que va en /galeria/<archivo>). */
export const archivoPublico = (clave: string) => clave.replace(/^publico\//, "");
const FORMATO_ARCHIVO_PUBLICO = /^[0-9a-f-]{36}-[0-9a-f]{8}-\d{1,4}\.(avif|webp)$/;

// ---------------------------------------------------------------------------
// Imágenes
// ---------------------------------------------------------------------------

/** Limpia la imagen (sin EXIF/GPS), guarda el original privado y la registra. */
export async function subirImagen(db: BaseDeDatos, alm: Almacenamiento, datos: Buffer, actor: Actor) {
  const original = await procesarOriginal(datos);
  const id = randomUUID();
  const clave = claveOriginal(id, original.formato);
  await alm.guardar(clave, original.datos);
  try {
    await db
      .insertInto("imagen")
      .values({
        id,
        clave_original: clave,
        formato: original.formato,
        ancho: original.ancho,
        alto: original.alto,
        bytes: original.datos.length,
        sha256: original.sha256,
        subido_por: actor.userId,
      })
      .execute();
  } catch (error) {
    await alm.borrar(clave);
    throw error;
  }
  await registrar(db, { actorId: actor.userId, actorTipo: "usuario", accion: "galeria.imagen_subida", entidad: "imagen", entidadId: id });
  return { id, ancho: original.ancho, alto: original.alto };
}

// ---------------------------------------------------------------------------
// Consentimiento de uso de imagen
// ---------------------------------------------------------------------------

export type DatosConsentimientoImagen = {
  pacienteId: string;
  fechaFirma: string;
  /** Documento firmado (PDF, JPEG o PNG). Obligatorio salvo que se marque "en físico". */
  archivo?: Buffer | null;
  enFisico: boolean;
  verificadoPor?: string | null;
  notas?: string;
};

/** Documento de consentimiento: PDF tal cual; fotos del documento, sin metadatos. */
async function prepararDocumento(datos: Buffer): Promise<{ datos: Buffer; tipo: "application/pdf" | "image/jpeg" | "image/png" }> {
  if (datos.length > TAMANO_MAXIMO) throw new ErrorGaleria("El documento supera 15 MB.");
  if (datos.subarray(0, 5).toString("latin1") === "%PDF-") return { datos, tipo: "application/pdf" };
  const formato = detectarFormato(datos);
  if (formato === "jpeg" || formato === "png" || formato === "webp" || formato === "heic") {
    const limpio = await procesarOriginal(datos);
    return { datos: limpio.datos, tipo: limpio.formato === "png" ? "image/png" : "image/jpeg" };
  }
  throw new ErrorGaleria("El documento debe ser PDF, JPEG o PNG.");
}

export async function registrarConsentimientoImagen(db: BaseDeDatos, alm: Almacenamiento, datos: DatosConsentimientoImagen, actor: Actor) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datos.fechaFirma) || Number.isNaN(Date.parse(datos.fechaFirma))) throw new ErrorGaleria("Indica la fecha de firma.");
  if (datos.fechaFirma > new Date().toISOString().slice(0, 10)) throw new ErrorGaleria("La fecha de firma no puede ser futura.");
  const paciente = await db.selectFrom("paciente").select(["id", "fusionado_con"]).where("id", "=", datos.pacienteId).executeTakeFirst();
  if (!paciente || paciente.fusionado_con) throw new ErrorGaleria("Elige un paciente válido.");

  const verificadoPor = datos.verificadoPor?.trim() || null;
  const archivo = datos.archivo && datos.archivo.length > 0 ? datos.archivo : null;
  if (!archivo && !datos.enFisico) throw new ErrorGaleria("Adjunta el documento firmado o marca que la autorización escrita está en físico.");
  if (datos.enFisico && (!verificadoPor || verificadoPor.length < 3)) throw new ErrorGaleria("Indica quién verificó la autorización en físico.");

  let documento: Awaited<ReturnType<typeof prepararDocumento>> | null = null;
  try {
    documento = archivo ? await prepararDocumento(archivo) : null;
  } catch (error) {
    if (error instanceof ImagenInvalida) throw new ErrorGaleria(error.message);
    throw error;
  }

  const id = randomUUID();
  const clave = documento ? `privado/consentimientos/${id}.${EXTENSION[documento.tipo]}` : null;
  if (clave && documento) await alm.guardar(clave, documento.datos);
  try {
    await db
      .insertInto("consentimiento_imagen")
      .values({
        id,
        paciente_id: paciente.id,
        fecha_firma: datos.fechaFirma,
        archivo_clave: clave,
        archivo_tipo: documento?.tipo ?? null,
        en_fisico: datos.enFisico,
        verificado_por: datos.enFisico ? verificadoPor : null,
        notas: (datos.notas ?? "").trim().slice(0, 500),
        registrado_por: actor.userId,
      })
      .execute();
  } catch (error) {
    if (clave) await alm.borrar(clave);
    throw error;
  }
  await registrar(db, {
    actorId: actor.userId,
    actorTipo: "usuario",
    accion: "galeria.consentimiento_registrado",
    entidad: "consentimiento_imagen",
    entidadId: id,
    detalle: { en_fisico: datos.enFisico, con_archivo: Boolean(clave) },
  });
  return { id };
}

export async function listarConsentimientosImagen(db: BaseDeDatos) {
  return db
    .selectFrom("consentimiento_imagen")
    .innerJoin("paciente", "paciente.id", "consentimiento_imagen.paciente_id")
    .select([
      "consentimiento_imagen.id",
      "consentimiento_imagen.fecha_firma",
      "consentimiento_imagen.en_fisico",
      "consentimiento_imagen.verificado_por",
      "consentimiento_imagen.archivo_clave",
      "paciente.id as pacienteId",
      "paciente.nombre as pacienteNombre",
    ])
    .orderBy("consentimiento_imagen.creado_en", "desc")
    .execute();
}

// ---------------------------------------------------------------------------
// Casos
// ---------------------------------------------------------------------------

export type DatosCaso = {
  procedimiento: string;
  servicioId?: string | null;
  descripcion?: string;
  imagenAntesId: string;
  imagenDespuesId: string;
  consentimientoImagenId?: string | null;
  orden?: number;
};

function validarCaso(d: DatosCaso) {
  const procedimiento = d.procedimiento.trim();
  if (procedimiento.length < 2 || procedimiento.length > 80) throw new ErrorGaleria("Escribe el procedimiento (2 a 80 caracteres).");
  const descripcion = (d.descripcion ?? "").trim();
  if (descripcion.length > 200) throw new ErrorGaleria("La descripción admite hasta 200 caracteres.");
  if (!d.imagenAntesId || !d.imagenDespuesId) throw new ErrorGaleria("Sube la imagen de antes y la de después.");
  if (d.imagenAntesId === d.imagenDespuesId) throw new ErrorGaleria("La imagen de antes y la de después deben ser distintas.");
  return {
    procedimiento,
    descripcion,
    servicio_id: d.servicioId || null,
    imagen_antes_id: d.imagenAntesId,
    imagen_despues_id: d.imagenDespuesId,
    consentimiento_imagen_id: d.consentimientoImagenId || null,
    orden: Number.isFinite(d.orden) ? Math.trunc(d.orden!) : 0,
  };
}

async function verificarImagenes(db: BaseDeDatos, ids: string[]) {
  const encontradas = await db.selectFrom("imagen").select("id").where("id", "in", ids).execute();
  if (encontradas.length !== new Set(ids).size) throw new ErrorGaleria("Una de las imágenes no existe. Súbela de nuevo.");
}

export async function crearCaso(db: BaseDeDatos, datos: DatosCaso, actor: Actor) {
  const valores = validarCaso(datos);
  await verificarImagenes(db, [valores.imagen_antes_id, valores.imagen_despues_id]);
  const { id } = await db
    .insertInto("caso_galeria")
    .values({ ...valores, creado_por: actor.userId })
    .returning("id")
    .executeTakeFirstOrThrow();
  await registrar(db, { actorId: actor.userId, actorTipo: "usuario", accion: "galeria.caso_creado", entidad: "caso_galeria", entidadId: id });
  return { id };
}

/** Edita un caso. Las imágenes y el consentimiento solo cambian en borrador; los textos, siempre. */
export async function actualizarCaso(db: BaseDeDatos, id: string, datos: DatosCaso, actor: Actor) {
  const valores = validarCaso(datos);
  await db.transaction().execute(async (trx) => {
    const caso = await trx.selectFrom("caso_galeria").selectAll().where("id", "=", id).forUpdate().executeTakeFirst();
    if (!caso) throw new ErrorGaleria("El caso no existe.");
    if (caso.estado === "publicado") {
      const cambia =
        caso.imagen_antes_id !== valores.imagen_antes_id ||
        caso.imagen_despues_id !== valores.imagen_despues_id ||
        caso.consentimiento_imagen_id !== valores.consentimiento_imagen_id;
      if (cambia) throw new ErrorGaleria("Para cambiar las imágenes o el consentimiento, primero despublica el caso.");
    } else {
      await verificarImagenes(trx, [valores.imagen_antes_id, valores.imagen_despues_id]);
    }
    await trx.updateTable("caso_galeria").set(valores).where("id", "=", id).execute();
  });
  await registrar(db, { actorId: actor.userId, actorTipo: "usuario", accion: "galeria.caso_editado", entidad: "caso_galeria", entidadId: id });
}

/** Imágenes que hoy usa algún caso publicado (distinto de `excepto`). */
async function imagenesPublicadas(db: BaseDeDatos, excepto?: string): Promise<Set<string>> {
  let q = db.selectFrom("caso_galeria").select(["imagen_antes_id", "imagen_despues_id"]).where("estado", "=", "publicado");
  if (excepto) q = q.where("id", "<>", excepto);
  const filas = await q.execute();
  return new Set(filas.flatMap((f) => [f.imagen_antes_id, f.imagen_despues_id]));
}

/**
 * Publica: genera las versiones públicas de las dos imágenes y marca el caso. Sin consentimiento, no.
 * Los archivos se escriben antes de la transacción; si esta falla, se borran.
 */
export async function publicarCaso(db: BaseDeDatos, alm: Almacenamiento, id: string, actor: Actor) {
  const caso = await db.selectFrom("caso_galeria").selectAll().where("id", "=", id).executeTakeFirst();
  if (!caso) throw new ErrorGaleria("El caso no existe.");
  if (caso.estado === "publicado") return;
  if (!caso.consentimiento_imagen_id) throw new ErrorGaleria("No se puede publicar sin un consentimiento de uso de imagen vinculado.");

  const imagenes = await db
    .selectFrom("imagen")
    .select(["id", "clave_original"])
    .where("id", "in", [caso.imagen_antes_id, caso.imagen_despues_id])
    .execute();
  const yaTienen = new Set(
    (await db.selectFrom("imagen_variante").select("imagen_id").where("imagen_id", "in", [caso.imagen_antes_id, caso.imagen_despues_id]).execute()).map(
      (v) => v.imagen_id,
    ),
  );

  const token = randomBytes(4).toString("hex");
  const nuevas: { imagen_id: string; clave: string; formato: "avif" | "webp"; ancho: number; alto: number; bytes: number }[] = [];
  let sobrantes: string[] = [];
  try {
    for (const imagen of imagenes.filter((i) => !yaTienen.has(i.id))) {
      const original = await alm.leer(imagen.clave_original);
      if (!original) throw new ErrorGaleria("Falta el archivo original de una imagen. Súbela de nuevo.");
      for (const v of await generarVariantes(original)) {
        const clave = claveVariante(imagen.id, token, v.ancho, v.formato);
        await alm.guardar(clave, v.datos);
        nuevas.push({ imagen_id: imagen.id, clave, formato: v.formato, ancho: v.ancho, alto: v.alto, bytes: v.datos.length });
      }
    }
    await db.transaction().execute(async (trx) => {
      const actual = await trx.selectFrom("caso_galeria").select(["estado", "consentimiento_imagen_id"]).where("id", "=", id).forUpdate().executeTakeFirst();
      if (!actual) throw new ErrorGaleria("El caso no existe.");
      if (!actual.consentimiento_imagen_id) throw new ErrorGaleria("No se puede publicar sin un consentimiento de uso de imagen vinculado.");
      // Otra publicación simultánea pudo ganar: no se duplican versiones y las nuestras sobran.
      const conVersiones = new Set(
        (
          await trx
            .selectFrom("imagen_variante")
            .select("imagen_id")
            .where("imagen_id", "in", [caso.imagen_antes_id, caso.imagen_despues_id])
            .execute()
        ).map((v) => v.imagen_id),
      );
      const insertar = actual.estado === "publicado" ? [] : nuevas.filter((v) => !conVersiones.has(v.imagen_id));
      sobrantes = nuevas.filter((v) => !insertar.includes(v)).map((v) => v.clave);
      if (actual.estado === "publicado") return;
      if (insertar.length > 0) await trx.insertInto("imagen_variante").values(insertar).execute();
      await trx
        .updateTable("caso_galeria")
        .set({ estado: "publicado", publicado_en: new Date(), publicado_por: actor.userId })
        .where("id", "=", id)
        .execute();
    });
  } catch (error) {
    for (const v of nuevas) await alm.borrar(v.clave);
    throw error;
  }
  for (const clave of sobrantes) await alm.borrar(clave);
  await registrar(db, { actorId: actor.userId, actorTipo: "usuario", accion: "galeria.caso_publicado", entidad: "caso_galeria", entidadId: id });
}

/** Despublica y retira las versiones públicas (salvo las de imágenes que otro caso publicado use). */
export async function despublicarCaso(db: BaseDeDatos, alm: Almacenamiento, id: string, actor: Actor) {
  const retiradas = await db.transaction().execute(async (trx) => {
    const caso = await trx.selectFrom("caso_galeria").selectAll().where("id", "=", id).forUpdate().executeTakeFirst();
    if (!caso) throw new ErrorGaleria("El caso no existe.");
    if (caso.estado !== "publicado") return [];
    await trx.updateTable("caso_galeria").set({ estado: "borrador", publicado_en: null, publicado_por: null }).where("id", "=", id).execute();
    const enUso = await imagenesPublicadas(trx, id);
    const retirar = [caso.imagen_antes_id, caso.imagen_despues_id].filter((i) => !enUso.has(i));
    if (retirar.length === 0) return [];
    return trx.deleteFrom("imagen_variante").where("imagen_id", "in", retirar).returning("clave").execute();
  });
  // Después del commit: si un borrado de archivo falla, la ruta pública ya no lo sirve (no hay fila ni caso publicado).
  for (const v of retiradas) await alm.borrar(v.clave);
  await registrar(db, {
    actorId: actor.userId,
    actorTipo: "usuario",
    accion: "galeria.caso_despublicado",
    entidad: "caso_galeria",
    entidadId: id,
    detalle: { versiones_retiradas: retiradas.length },
  });
}

export async function listarCasosPanel(db: BaseDeDatos) {
  return db
    .selectFrom("caso_galeria")
    .leftJoin("consentimiento_imagen", "consentimiento_imagen.id", "caso_galeria.consentimiento_imagen_id")
    .leftJoin("paciente", "paciente.id", "consentimiento_imagen.paciente_id")
    .select([
      "caso_galeria.id",
      "caso_galeria.procedimiento",
      "caso_galeria.descripcion",
      "caso_galeria.estado",
      "caso_galeria.orden",
      "caso_galeria.imagen_antes_id",
      "caso_galeria.imagen_despues_id",
      "caso_galeria.publicado_en",
      "paciente.nombre as pacienteNombre",
    ])
    .orderBy("caso_galeria.orden")
    .orderBy("caso_galeria.creado_en", "desc")
    .execute();
}

export async function obtenerCaso(db: BaseDeDatos, id: string) {
  return db.selectFrom("caso_galeria").selectAll().where("id", "=", id).executeTakeFirst();
}

// ---------------------------------------------------------------------------
// Lectura pública
// ---------------------------------------------------------------------------

export type ImagenPublica = { ancho: number; alto: number; avif: string; webp: string };
export type CasoPublico = { id: string; procedimiento: string; descripcion: string; antes: ImagenPublica; despues: ImagenPublica };

/** Casos publicados con sus versiones. Sin datos del paciente. */
export async function casosPublicados(db: BaseDeDatos): Promise<CasoPublico[]> {
  const casos = await db
    .selectFrom("caso_galeria")
    .select(["id", "procedimiento", "descripcion", "imagen_antes_id", "imagen_despues_id"])
    .where("estado", "=", "publicado")
    .where("consentimiento_imagen_id", "is not", null)
    .orderBy("orden")
    .orderBy("publicado_en", "desc")
    .execute();
  if (casos.length === 0) return [];
  const ids = casos.flatMap((c) => [c.imagen_antes_id, c.imagen_despues_id]);
  const variantes = await db.selectFrom("imagen_variante").select(["imagen_id", "clave", "formato", "ancho", "alto"]).where("imagen_id", "in", ids).orderBy("ancho").execute();

  const imagen = (id: string): ImagenPublica | null => {
    const propias = variantes.filter((v) => v.imagen_id === id);
    const mayor = propias.at(-1);
    if (!mayor) return null;
    const srcset = (formato: string) =>
      propias
        .filter((v) => v.formato === formato)
        .map((v) => `/galeria/${archivoPublico(v.clave)} ${v.ancho}w`)
        .join(", ");
    return { ancho: mayor.ancho, alto: mayor.alto, avif: srcset("avif"), webp: srcset("webp") };
  };

  return casos.flatMap((c) => {
    const antes = imagen(c.imagen_antes_id);
    const despues = imagen(c.imagen_despues_id);
    return antes && despues ? [{ id: c.id, procedimiento: c.procedimiento, descripcion: c.descripcion, antes, despues }] : [];
  });
}

/** Versión pública solicitada, solo si pertenece a una imagen de un caso publicado. */
export async function varianteParaServir(db: BaseDeDatos, archivo: string): Promise<{ clave: string; formato: "avif" | "webp" } | null> {
  if (!FORMATO_ARCHIVO_PUBLICO.test(archivo)) return null;
  const fila = await db
    .selectFrom("imagen_variante")
    .select(["imagen_variante.clave", "imagen_variante.formato"])
    .where("imagen_variante.clave", "=", `publico/${archivo}`)
    .where((eb) =>
      eb.exists(
        eb
          .selectFrom("caso_galeria")
          .select("caso_galeria.id")
          .where("caso_galeria.estado", "=", "publicado")
          .where((w) => w.or([w("caso_galeria.imagen_antes_id", "=", w.ref("imagen_variante.imagen_id")), w("caso_galeria.imagen_despues_id", "=", w.ref("imagen_variante.imagen_id"))])),
      ),
    )
    .executeTakeFirst();
  return fila ? { clave: fila.clave, formato: fila.formato as "avif" | "webp" } : null;
}

// ---------------------------------------------------------------------------
// Archivos privados (solo panel, con auditoría)
// ---------------------------------------------------------------------------

export async function archivoPrivado(
  db: BaseDeDatos,
  alm: Almacenamiento,
  tipo: "imagen" | "consentimiento",
  id: string,
  actor: Actor,
): Promise<{ datos: Buffer; contentType: string } | null> {
  const fila =
    tipo === "imagen"
      ? await db
          .selectFrom("imagen")
          .select(["clave_original as clave", "formato"])
          .where("id", "=", id)
          .executeTakeFirst()
          .then((f) => f && { clave: f.clave, contentType: f.formato === "png" ? "image/png" : "image/jpeg" })
      : await db
          .selectFrom("consentimiento_imagen")
          .select(["archivo_clave as clave", "archivo_tipo"])
          .where("id", "=", id)
          .executeTakeFirst()
          .then((f) => f?.clave && f.archivo_tipo ? { clave: f.clave, contentType: f.archivo_tipo } : undefined);
  if (!fila) return null;
  const datos = await alm.leer(fila.clave);
  if (!datos) return null;
  await registrar(db, { actorId: actor.userId, actorTipo: "usuario", accion: "archivo.leido", entidad: tipo === "imagen" ? "imagen" : "consentimiento_imagen", entidadId: id });
  return { datos, contentType: fila.contentType };
}
