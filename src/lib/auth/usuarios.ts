import { registrar } from "@/modules/auditoria";
import type { BaseDeDatos } from "../db";
import type { Auth } from "./index";

export const LONGITUD_MINIMA_CONTRASENA = 12;

function validarContrasena(contrasena: string) {
  if (contrasena.length < LONGITUD_MINIMA_CONTRASENA) {
    throw new Error(`La contraseña debe tener al menos ${LONGITUD_MINIMA_CONTRASENA} caracteres.`);
  }
  if (contrasena.length > 128) throw new Error("La contraseña no puede superar 128 caracteres.");
}

function normalizarCorreo(correo: string) {
  const limpio = correo.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpio)) throw new Error("Correo inválido.");
  return limpio;
}

/** Crea una cuenta con acceso al panel. Solo se usa desde la consola (no hay registro público). */
export async function crearUsuarioAdmin(
  auth: Auth,
  db: BaseDeDatos,
  datos: { correo: string; nombre: string; contrasena: string },
): Promise<{ userId: string }> {
  const correo = normalizarCorreo(datos.correo);
  const nombre = datos.nombre.trim();
  if (!nombre) throw new Error("El nombre es obligatorio.");
  validarContrasena(datos.contrasena);

  const ctx = await auth.$context;
  if (await ctx.internalAdapter.findUserByEmail(correo)) throw new Error("Ya existe una cuenta con ese correo.");

  const hash = await ctx.password.hash(datos.contrasena);
  const usuario = await ctx.internalAdapter.createUser(
    { email: correo, name: nombre, emailVerified: true },
    { method: "admin" },
  );
  await ctx.internalAdapter.linkAccount({
    userId: usuario.id,
    providerId: "credential",
    accountId: usuario.id,
    password: hash,
  });
  await db.insertInto("usuario").values({ user_id: usuario.id, rol: "admin" }).execute();
  await registrar(db, {
    actorTipo: "sistema",
    accion: "usuario.creado",
    entidad: "usuario",
    entidadId: usuario.id,
    detalle: { rol: "admin" },
  });
  return { userId: usuario.id };
}

/** Cambia la contraseña y cierra todas las sesiones abiertas de esa cuenta. */
export async function cambiarContrasena(
  auth: Auth,
  db: BaseDeDatos,
  datos: { correo: string; contrasena: string },
): Promise<void> {
  const correo = normalizarCorreo(datos.correo);
  validarContrasena(datos.contrasena);

  const ctx = await auth.$context;
  const encontrado = await ctx.internalAdapter.findUserByEmail(correo);
  if (!encontrado) throw new Error("No existe una cuenta con ese correo.");

  const hash = await ctx.password.hash(datos.contrasena);
  await ctx.internalAdapter.updatePassword(encontrado.user.id, hash);
  await ctx.internalAdapter.deleteUserSessions(encontrado.user.id);
  await registrar(db, {
    actorTipo: "sistema",
    accion: "usuario.contrasena_cambiada",
    entidad: "usuario",
    entidadId: encontrado.user.id,
  });
}
