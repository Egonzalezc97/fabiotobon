import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware, getIP, getSessionFromCtx, isAPIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { twoFactor, username } from "better-auth/plugins";
import { registrar } from "@/modules/auditoria";
import { db, type BaseDeDatos } from "../db";
import { env } from "../env";
import { bloqueadoHasta, limpiarIntentos, normalizarIntento, registrarFallo } from "./intentos";

export const NOMBRE_APP = "Fabio Tobón Odontología";

// Rutas de Better Auth cuyos fallos se auditan (intentos de ingreso).
const RUTAS_INGRESO = new Set(["/sign-in/username", "/two-factor/verify-totp", "/two-factor/verify-backup-code"]);

/**
 * Sesión: vence tras 8 horas sin actividad (se renueva como máximo cada 15 minutos) y nunca dura más de 12 horas
 * aunque haya actividad (ese tope lo aplica evaluarAcceso). 2FA opcional por decisión del 2026-10-08.
 */
export const SESION = { inactividadSeg: 8 * 60 * 60, renovacionSeg: 15 * 60, topeHoras: 12 } as const;

/** Mensaje único para el bloqueo por usuario: no revela si la cuenta existe. */
export const MENSAJE_BLOQUEO = "Demasiados intentos. Espera unos minutos y vuelve a intentarlo.";

/** Id de la cuenta con ese nombre de usuario (en minúsculas), si existe. */
async function idPorUsuario(db: BaseDeDatos, usuario: string): Promise<string | null> {
  const fila = await db.selectFrom("user").select("id").where("username", "=", usuario).executeTakeFirst();
  return fila?.id ?? null;
}

/** Nombre de usuario: solo letras, números y punto, 3 a 30 caracteres (se guarda en minúsculas). */
export const FORMATO_USUARIO = /^[a-z0-9.]{3,30}$/;

/** Id del usuario si la respuesta de Better Auth corresponde a una sesión abierta. */
function idUsuarioIngresado(respuesta: unknown): string | null {
  if (typeof respuesta !== "object" || respuesta === null) return null;
  if ("twoFactorRedirect" in respuesta) return null;
  if (!("token" in respuesta) || !("user" in respuesta)) return null;
  const { user } = respuesta;
  if (typeof user !== "object" || user === null || !("id" in user)) return null;
  return typeof user.id === "string" ? user.id : null;
}

type OpcionesAuth = { db: BaseDeDatos; secret: string; baseURL: string; limitarIntentos: boolean };

export function crearAuth(opciones: OpcionesAuth) {
  const { db } = opciones;
  return betterAuth({
    appName: NOMBRE_APP,
    baseURL: opciones.baseURL,
    secret: opciones.secret,
    database: { db, type: "postgres" },
    telemetry: { enabled: false },
    // Se ingresa con nombre de usuario; el ingreso por correo queda cerrado (una sola puerta).
    disabledPaths: ["/sign-in/email"],
    emailAndPassword: {
      enabled: true,
      // Sin registro público: las cuentas se crean con `npm run usuario:crear`.
      disableSignUp: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
    },
    session: {
      expiresIn: SESION.inactividadSeg,
      updateAge: SESION.renovacionSeg,
    },
    rateLimit: {
      enabled: opciones.limitarIntentos,
      // En la base: un reinicio del servidor no pone los contadores en cero.
      storage: "database",
      window: 60,
      max: 60,
      customRules: {
        // Por IP. 10 y no 5: el consultorio comparte IP (Fabio y la asistente no deben bloquearse entre sí).
        // El bloqueo por usuario (5 fallos) va aparte, en intentos.ts.
        "/sign-in/username": { window: 300, max: 10 },
        "/change-password": { window: 300, max: 5 },
        "/two-factor/verify-totp": { window: 300, max: 5 },
        "/two-factor/verify-backup-code": { window: 300, max: 5 },
        "/two-factor/enable": { window: 300, max: 5 },
      },
    },
    plugins: [
      username({
        displayUsername: false,
        minUsernameLength: 3,
        maxUsernameLength: 30,
        usernameValidator: (u) => /^[a-zA-Z0-9.]+$/.test(u),
      }),
      twoFactor({
        issuer: NOMBRE_APP,
        // El segundo factor solo queda activo tras comprobar un primer código.
        skipVerificationOnEnable: false,
        accountLockout: { enabled: true, maxFailedAttempts: 5, durationSeconds: 900 },
      }),
      // Debe ir de último: permite que las acciones de servidor fijen cookies.
      nextCookies(),
    ],
    hooks: {
      // Bloqueo por usuario: se revisa antes de validar la contraseña (bloqueado, ni la correcta entra).
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/sign-in/username") return;
        const usuario = normalizarIntento((ctx.body as { username?: unknown } | undefined)?.username);
        if (usuario && (await bloqueadoHasta(db, usuario))) throw new APIError("TOO_MANY_REQUESTS", { message: MENSAJE_BLOQUEO });
      }),
      after: createAuthMiddleware(async (ctx) => {
        const respuesta = ctx.context.returned;
        const encabezados = ctx.request?.headers ?? ctx.headers;
        const ip = encabezados ? getIP(encabezados, ctx.context.options) : null;
        const userAgent = encabezados?.get("user-agent") ?? null;

        // Activar o desactivar el 2FA (opcional) desde Mi cuenta queda en auditoría.
        if (ctx.path === "/two-factor/disable" || ctx.path === "/two-factor/verify-totp") {
          if (isAPIError(respuesta)) return;
          // Con sesión abierta, verify-totp es la activación; sin sesión es el segundo paso de un ingreso (abajo).
          const sesion = ctx.path === "/two-factor/disable" ? ctx.context.session : await getSessionFromCtx(ctx).catch(() => null);
          if (sesion) {
            await registrar(db, {
              actorId: sesion.user.id,
              actorTipo: "usuario",
              accion: ctx.path === "/two-factor/disable" ? "segundo_factor.desactivado" : "segundo_factor.activado",
              entidad: "usuario",
              entidadId: sesion.user.id,
              ip,
              userAgent,
            });
            return;
          }
        }
        if (!RUTAS_INGRESO.has(ctx.path)) return;
        const usuarioEscrito =
          ctx.path === "/sign-in/username" ? normalizarIntento((ctx.body as { username?: unknown } | undefined)?.username) : null;

        if (isAPIError(respuesta)) {
          // Se guarda la cuenta (id) si el nombre corresponde a una; si no, "desconocido". Nunca el texto escrito:
          // podría ser una contraseña puesta en el campo equivocado.
          const usuarioId = usuarioEscrito ? ((await idPorUsuario(db, usuarioEscrito)) ?? "desconocido") : undefined;
          await registrar(db, {
            actorTipo: "anonimo",
            accion: "sesion.fallida",
            detalle: { ruta: ctx.path, estado: respuesta.statusCode, ...(usuarioId ? { usuario_id: usuarioId } : {}) },
            ip,
            userAgent,
          });
          // Solo las credenciales incorrectas cuentan para el bloqueo (no los rechazos por otras causas).
          if (usuarioEscrito && respuesta.statusCode === 401) {
            const hasta = await registrarFallo(db, usuarioEscrito);
            if (hasta) {
              await registrar(db, {
                actorTipo: "anonimo",
                accion: "sesion.bloqueada",
                detalle: { usuario_id: usuarioId ?? "desconocido", hasta: hasta.toISOString() },
                ip,
                userAgent,
              });
            }
          }
          return;
        }
        const userId = idUsuarioIngresado(respuesta);
        if (!userId) return;
        // Contraseña correcta: el contador de fallos vuelve a cero (también si luego se pide el código del 2FA).
        if (usuarioEscrito) await limpiarIntentos(db, usuarioEscrito);
        // Con segundo factor activado, la contraseña correcta todavía no es un ingreso: el plugin
        // (que corre después de este hook) cambia la respuesta por twoFactorRedirect y descarta la sesión.
        // El ingreso se registra cuando se verifica el código.
        if (ctx.path === "/sign-in/username") {
          const usuario = await db
            .selectFrom("user")
            .select("twoFactorEnabled")
            .where("id", "=", userId)
            .executeTakeFirst();
          if (usuario?.twoFactorEnabled) return;
        }
        await registrar(db, {
          actorId: userId,
          actorTipo: "usuario",
          accion: "sesion.iniciada",
          detalle: { ruta: ctx.path },
          ip,
          userAgent,
        });
      }),
    },
  });
}

export type Auth = ReturnType<typeof crearAuth>;

/**
 * Atiende una petición HTTP de Better Auth. El limitador de intentos responde 429 antes de que
 * corran los hooks, así que esos rechazos se auditan aquí. Nunca se lee el cuerpo (correo, contraseña).
 */
export async function atenderPeticionAuth(a: Auth, db: BaseDeDatos, peticion: Request): Promise<Response> {
  const respuesta = await a.handler(peticion);
  if (respuesta.status === 429) {
    await registrar(db, {
      actorTipo: "anonimo",
      accion: "sesion.limitada",
      detalle: { ruta: new URL(peticion.url).pathname.replace(/^\/api\/auth/, "") },
      ip: getIP(peticion, a.options),
      userAgent: peticion.headers.get("user-agent"),
    });
  }
  return respuesta;
}

const global = globalThis as typeof globalThis & { __fabiotobonAuth?: Auth };

/** Instancia de la aplicación, creada al primer uso con las variables de entorno. */
export function auth(): Auth {
  global.__fabiotobonAuth ??= crearAuth({
    db: db(),
    secret: env().BETTER_AUTH_SECRET,
    baseURL: env().BETTER_AUTH_URL,
    limitarIntentos: process.env.NODE_ENV !== "test",
  });
  return global.__fabiotobonAuth;
}
