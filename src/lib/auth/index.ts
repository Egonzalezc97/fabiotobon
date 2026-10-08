import { betterAuth } from "better-auth";
import { createAuthMiddleware, getIP, isAPIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins";
import { registrar } from "@/modules/auditoria";
import { db, type BaseDeDatos } from "../db";
import { env } from "../env";

export const NOMBRE_APP = "Fabio Tobón Odontología";

// Rutas de Better Auth cuyos fallos se auditan (intentos de ingreso).
const RUTAS_INGRESO = new Set(["/sign-in/email", "/two-factor/verify-totp", "/two-factor/verify-backup-code"]);

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
    emailAndPassword: {
      enabled: true,
      // Sin registro público: las cuentas se crean con `npm run usuario:crear`.
      disableSignUp: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
    },
    session: {
      expiresIn: 60 * 60 * 12, // 12 horas
      updateAge: 60 * 60, // se renueva como máximo una vez por hora
    },
    rateLimit: {
      enabled: opciones.limitarIntentos,
      window: 60,
      max: 60,
      customRules: {
        "/sign-in/email": { window: 300, max: 5 },
        "/two-factor/verify-totp": { window: 300, max: 5 },
        "/two-factor/verify-backup-code": { window: 300, max: 5 },
        "/two-factor/enable": { window: 300, max: 5 },
      },
    },
    plugins: [
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
      after: createAuthMiddleware(async (ctx) => {
        if (!RUTAS_INGRESO.has(ctx.path)) return;
        const respuesta = ctx.context.returned;
        const encabezados = ctx.request?.headers ?? ctx.headers;
        const ip = encabezados ? getIP(encabezados, ctx.context.options) : null;
        const userAgent = encabezados?.get("user-agent") ?? null;

        if (isAPIError(respuesta)) {
          await registrar(db, {
            actorTipo: "anonimo",
            accion: "sesion.fallida",
            // No se guarda el correo intentado: puede ser dato de un tercero o una contraseña mal escrita.
            detalle: { ruta: ctx.path, estado: respuesta.statusCode },
            ip,
            userAgent,
          });
          return;
        }
        const userId = idUsuarioIngresado(respuesta);
        if (!userId) return;
        // Con segundo factor activado, la contraseña correcta todavía no es un ingreso: el plugin
        // (que corre después de este hook) cambia la respuesta por twoFactorRedirect y descarta la sesión.
        // El ingreso se registra cuando se verifica el código.
        if (ctx.path === "/sign-in/email") {
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
