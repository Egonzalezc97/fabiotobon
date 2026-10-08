import { randomUUID } from "node:crypto";
import { sql } from "kysely";
import { registrar } from "@/modules/auditoria";
import type { BaseDeDatos } from "../db";
import { FORMATO_USUARIO, type Auth } from "./index";

// Cuentas del panel: individuales, nunca compartidas. Se ingresa con nombre de usuario.
// El correo es opcional: Better Auth exige uno, así que sin correo real se guarda una dirección
// interna en el dominio reservado .invalid, que nunca recibe mensajes.

export const LONGITUD_MINIMA_CONTRASENA = 12;
export const DOMINIO_SIN_CORREO = "sin-correo.invalid";
export type Rol = "admin" | "asistente";
export const NOMBRES_ROL: Record<Rol, string> = { admin: "Administrador", asistente: "Asistente" };

export class ErrorUsuarios extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ErrorUsuarios";
  }
}

type Actor = { userId: string } | null;

function actorAuditoria(actor: Actor) {
  return actor ? { actorId: actor.userId, actorTipo: "usuario" as const } : { actorTipo: "sistema" as const };
}

function validarContrasena(contrasena: string) {
  if (contrasena.length < LONGITUD_MINIMA_CONTRASENA) {
    throw new ErrorUsuarios(`La contraseña debe tener al menos ${LONGITUD_MINIMA_CONTRASENA} caracteres.`);
  }
  if (contrasena.length > 128) throw new ErrorUsuarios("La contraseña no puede superar 128 caracteres.");
}

function normalizarCorreoOpcional(correo: string | null | undefined): string | null {
  const limpio = (correo ?? "").trim().toLowerCase();
  if (!limpio) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpio) || limpio.endsWith(`@${DOMINIO_SIN_CORREO}`)) {
    throw new ErrorUsuarios("Correo inválido.");
  }
  return limpio;
}

/** El correo real de la cuenta, o null si es la dirección interna. */
export function correoReal(email: string): string | null {
  return email.endsWith(`@${DOMINIO_SIN_CORREO}`) ? null : email;
}

export function normalizarNombreUsuario(usuario: string): string {
  const limpio = usuario.trim().toLowerCase();
  if (!FORMATO_USUARIO.test(limpio)) {
    throw new ErrorUsuarios("El nombre de usuario debe tener de 3 a 30 caracteres: solo letras, números y punto.");
  }
  return limpio;
}

/**
 * Sugerencia: inicial del primer nombre + primer apellido + inicial del segundo apellido, sin tildes ni
 * mayúsculas (Fabio Tobón Casas → ftobonc). Con dos palabras: inicial + apellido. Misma regla que la migración 0007.
 * Con nombres compuestos puede no acertar: el admin la edita antes de guardar.
 */
export function sugerirNombreUsuario(nombreCompleto: string): string {
  const partes = nombreCompleto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/\s+/)
    .map((p) => p.replace(/[^a-z0-9]/g, ""))
    .filter(Boolean);
  const n = partes.length;
  let base =
    n >= 3
      ? `${partes[0]![0]}${partes[n - 2]}${partes[n - 1]![0]}`
      : n === 2
        ? `${partes[0]![0]}${partes[1]}`
        : (partes[0] ?? "usuario");
  base = base.slice(0, 27);
  return base.length < 3 ? base.padEnd(3, "0") : base;
}

/** La sugerencia, con número si ya existe (ftobonc, ftobonc2, ftobonc3…). */
export async function nombreUsuarioDisponible(db: BaseDeDatos, base: string): Promise<string> {
  const ocupados = new Set(
    (await db.selectFrom("user").select("username").where("username", "like", `${base}%`).execute()).map((u) => u.username),
  );
  if (!ocupados.has(base)) return base;
  for (let i = 2; ; i++) if (!ocupados.has(`${base}${i}`)) return `${base}${i}`;
}

async function buscarPorUsuario(db: BaseDeDatos, usuario: string) {
  const fila = await db.selectFrom("user").select(["id"]).where("username", "=", usuario.trim().toLowerCase()).executeTakeFirst();
  if (!fila) throw new ErrorUsuarios("No existe una cuenta con ese nombre de usuario.");
  return fila.id;
}

export type DatosNuevoUsuario = {
  nombre: string;
  usuario: string;
  correo?: string | null;
  rol: Rol;
  contrasena: string;
  /** Contraseña temporal: en el primer ingreso debe cambiarla. */
  temporal: boolean;
};

/** Crea una cuenta del panel (desde el panel o la consola; no hay registro público). */
export async function crearUsuario(auth: Auth, db: BaseDeDatos, datos: DatosNuevoUsuario, actor: Actor): Promise<{ userId: string }> {
  const nombre = datos.nombre.trim().replace(/\s+/g, " ");
  if (nombre.length < 2 || nombre.length > 120) throw new ErrorUsuarios("Escribe el nombre completo.");
  const usuario = normalizarNombreUsuario(datos.usuario);
  const correo = normalizarCorreoOpcional(datos.correo);
  if (datos.rol !== "admin" && datos.rol !== "asistente") throw new ErrorUsuarios("Rol no válido.");
  validarContrasena(datos.contrasena);

  const ctx = await auth.$context;
  if (await db.selectFrom("user").select("id").where("username", "=", usuario).executeTakeFirst()) {
    throw new ErrorUsuarios("Ese nombre de usuario ya existe.");
  }
  if (correo && (await ctx.internalAdapter.findUserByEmail(correo))) throw new ErrorUsuarios("Ya existe una cuenta con ese correo.");

  const hash = await ctx.password.hash(datos.contrasena);
  const creado = await ctx.internalAdapter.createUser(
    { email: correo ?? `${randomUUID()}@${DOMINIO_SIN_CORREO}`, name: nombre, emailVerified: Boolean(correo), username: usuario },
    { method: "admin" },
  );
  await ctx.internalAdapter.linkAccount({ userId: creado.id, providerId: "credential", accountId: creado.id, password: hash });
  await db
    .insertInto("usuario")
    .values({ user_id: creado.id, rol: datos.rol, debe_cambiar_contrasena: datos.temporal, creado_por: actor?.userId ?? null })
    .execute();
  await registrar(db, {
    ...actorAuditoria(actor),
    accion: "usuario.creado",
    entidad: "usuario",
    entidadId: creado.id,
    detalle: { rol: datos.rol, usuario, con_correo: Boolean(correo), contrasena_temporal: datos.temporal },
  });
  return { userId: creado.id };
}

export type UsuarioPanel = {
  userId: string;
  nombre: string;
  usuario: string | null;
  correo: string | null;
  rol: Rol;
  activo: boolean;
  segundoFactor: boolean;
  debeCambiarContrasena: boolean;
  creadoEn: Date;
};

export async function listarUsuarios(db: BaseDeDatos): Promise<UsuarioPanel[]> {
  const filas = await db
    .selectFrom("usuario")
    .innerJoin("user", "user.id", "usuario.user_id")
    .select([
      "usuario.user_id",
      "usuario.rol",
      "usuario.activo",
      "usuario.debe_cambiar_contrasena",
      "usuario.creado_en",
      "user.name",
      "user.username",
      "user.email",
      "user.twoFactorEnabled",
    ])
    .orderBy("usuario.activo", "desc")
    .orderBy("user.name")
    .execute();
  return filas.map((f) => ({
    userId: f.user_id,
    nombre: f.name,
    usuario: f.username,
    correo: correoReal(f.email),
    rol: f.rol as Rol,
    activo: f.activo,
    segundoFactor: Boolean(f.twoFactorEnabled),
    debeCambiarContrasena: f.debe_cambiar_contrasena,
    creadoEn: f.creado_en,
  }));
}

/**
 * Cambia rol o estado garantizando que siempre quede al menos un admin activo.
 * Bloquea las filas de admins para que dos cambios simultáneos no dejen el panel sin admin.
 */
async function conAdminGarantizado(
  db: BaseDeDatos,
  userId: string,
  cambio: { rol?: Rol; activo?: boolean },
  accion: string,
  actor: Actor,
): Promise<void> {
  await db.transaction().execute(async (trx) => {
    await sql`SELECT user_id FROM usuario WHERE rol = 'admin' AND activo FOR UPDATE`.execute(trx);
    const actual = await trx.selectFrom("usuario").select(["rol", "activo"]).where("user_id", "=", userId).forUpdate().executeTakeFirst();
    if (!actual) throw new ErrorUsuarios("El usuario no existe.");
    const quedaAdminActivo = (cambio.rol ?? actual.rol) === "admin" && (cambio.activo ?? actual.activo);
    if (actual.rol === "admin" && actual.activo && !quedaAdminActivo) {
      const otros = await trx
        .selectFrom("usuario")
        .select((eb) => eb.fn.countAll<string>().as("n"))
        .where("rol", "=", "admin")
        .where("activo", "=", true)
        .where("user_id", "!=", userId)
        .executeTakeFirstOrThrow();
      if (Number(otros.n) === 0) throw new ErrorUsuarios("Debe quedar al menos un administrador activo.");
    }
    await trx.updateTable("usuario").set(cambio).where("user_id", "=", userId).execute();
    if (cambio.activo === false) await trx.deleteFrom("session").where("userId", "=", userId).execute();
    await registrar(trx, {
      ...actorAuditoria(actor),
      accion,
      entidad: "usuario",
      entidadId: userId,
      detalle: { antes_rol: actual.rol, antes_activo: actual.activo, ...cambio },
    });
  });
}

export async function cambiarRol(db: BaseDeDatos, userId: string, rol: Rol, actor: Actor) {
  if (rol !== "admin" && rol !== "asistente") throw new ErrorUsuarios("Rol no válido.");
  await conAdminGarantizado(db, userId, { rol }, "usuario.rol_cambiado", actor);
}

/** Desactivar (nunca borrar) cierra sus sesiones. Reactivar devuelve el acceso. */
export async function cambiarActivo(db: BaseDeDatos, userId: string, activo: boolean, actor: Actor) {
  await conAdminGarantizado(db, userId, { activo }, activo ? "usuario.reactivado" : "usuario.desactivado", actor);
}

/** Pone una contraseña temporal, obliga a cambiarla en el siguiente ingreso y cierra sus sesiones. */
export async function forzarCambioContrasena(auth: Auth, db: BaseDeDatos, userId: string, temporal: string, actor: Actor) {
  validarContrasena(temporal);
  const ctx = await auth.$context;
  await ctx.internalAdapter.updatePassword(userId, await ctx.password.hash(temporal));
  await ctx.internalAdapter.deleteUserSessions(userId);
  await db.updateTable("usuario").set({ debe_cambiar_contrasena: true }).where("user_id", "=", userId).execute();
  await registrar(db, { ...actorAuditoria(actor), accion: "usuario.cambio_contrasena_forzado", entidad: "usuario", entidadId: userId });
}

/** Cambia la contraseña de una cuenta (consola) y cierra todas sus sesiones. */
export async function cambiarContrasena(auth: Auth, db: BaseDeDatos, datos: { usuario: string; contrasena: string }, actor: Actor = null) {
  validarContrasena(datos.contrasena);
  const userId = await buscarPorUsuario(db, datos.usuario);
  const ctx = await auth.$context;
  await ctx.internalAdapter.updatePassword(userId, await ctx.password.hash(datos.contrasena));
  await ctx.internalAdapter.deleteUserSessions(userId);
  await db.updateTable("usuario").set({ debe_cambiar_contrasena: false }).where("user_id", "=", userId).execute();
  await registrar(db, { ...actorAuditoria(actor), accion: "usuario.contrasena_cambiada", entidad: "usuario", entidadId: userId });
}

/**
 * El propio usuario cambia su contraseña (primer ingreso o cambio forzado). Usa el endpoint de Better Auth,
 * que exige la contraseña actual y renueva la sesión.
 */
export async function cambiarContrasenaPropia(
  auth: Auth,
  db: BaseDeDatos,
  headers: Headers,
  datos: { actual: string; nueva: string },
  userId: string,
) {
  validarContrasena(datos.nueva);
  if (datos.nueva === datos.actual) throw new ErrorUsuarios("La contraseña nueva debe ser distinta de la actual.");
  try {
    await auth.api.changePassword({ body: { currentPassword: datos.actual, newPassword: datos.nueva, revokeOtherSessions: true }, headers });
  } catch {
    throw new ErrorUsuarios("La contraseña actual no es correcta.");
  }
  await db.updateTable("usuario").set({ debe_cambiar_contrasena: false }).where("user_id", "=", userId).execute();
  await registrar(db, { actorId: userId, actorTipo: "usuario", accion: "usuario.contrasena_cambiada", entidad: "usuario", entidadId: userId });
}

/**
 * Para cuando se pierde el celular y los códigos de respaldo: borra el segundo factor y cierra
 * todas las sesiones. En el siguiente ingreso la cuenta tendrá que activarlo de nuevo.
 */
export async function reiniciarSegundoFactor(
  db: BaseDeDatos,
  datos: { userId?: string; usuario?: string; motivo: string },
  actor: Actor = null,
): Promise<void> {
  const motivo = datos.motivo.trim();
  if (motivo.length < 5) throw new ErrorUsuarios("Escribe el motivo del reinicio (mínimo 5 caracteres).");
  const userId = datos.userId ?? (await buscarPorUsuario(db, datos.usuario ?? ""));

  await db.transaction().execute(async (trx) => {
    await trx.deleteFrom("twoFactor").where("userId", "=", userId).execute();
    await trx.updateTable("user").set({ twoFactorEnabled: false, updatedAt: new Date() }).where("id", "=", userId).execute();
    await trx.deleteFrom("session").where("userId", "=", userId).execute();
    await registrar(trx, {
      ...actorAuditoria(actor),
      accion: "usuario.segundo_factor_reiniciado",
      entidad: "usuario",
      entidadId: userId,
      detalle: { motivo: motivo.slice(0, 200) },
    });
  });
}
