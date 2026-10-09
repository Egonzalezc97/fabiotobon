// La contraseña es la única barrera obligatoria (2FA opcional, decisión del 2026-10-08): bloqueo por usuario,
// sesión por inactividad con tope absoluto, auditoría y 2FA como opción en Mi cuenta.
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { auth, MENSAJE_BLOQUEO, SESION } from "@/lib/auth";
import { evaluarAcceso } from "@/lib/auth/acceso";
import { bloqueadoHasta, desbloquearIngreso, LIMITES_INGRESO, registrarFallo } from "@/lib/auth/intentos";
import { crearUsuario, LONGITUD_MINIMA_CONTRASENA } from "@/lib/auth/usuarios";
import { cerrarDb, db } from "@/lib/db";
import { codigoTotp, headersConCookie, limpiarDatos, llamar, unirCookies } from "./ayudas";

const USUARIO = "ftobonc";
const CONTRASENA = "una-contrasena-larga-de-prueba";
const MAL = "contrasena-equivocada-123";

afterAll(cerrarDb);
beforeEach(() => limpiarDatos(db()));

const crear = (usuario = USUARIO, rol: "admin" | "asistente" = "admin") =>
  crearUsuario(auth(), db(), { nombre: "Fabio Tobón Casas", usuario, correo: null, rol, contrasena: CONTRASENA, temporal: false }, null);

async function ingresar(usuario = USUARIO, contrasena = CONTRASENA) {
  const r = await llamar(auth(), "/sign-in/username", { username: usuario, password: contrasena });
  return { ...r, cookie: unirCookies(undefined, r.cookies) };
}

const estado = (cookie: string, ahora?: Date) => evaluarAcceso(auth(), db(), headersConCookie(cookie), ahora);
const acciones = async (accion: string) => db().selectFrom("auditoria").selectAll().where("accion", "=", accion).orderBy("id").execute();

describe("contraseña", () => {
  it("exige al menos 12 caracteres", async () => {
    expect(LONGITUD_MINIMA_CONTRASENA).toBe(12);
    await expect(
      crearUsuario(auth(), db(), { nombre: "X Y", usuario: "corta", correo: null, rol: "admin", contrasena: "11caractere", temporal: false }, null),
    ).rejects.toThrow(/12 caracteres/);
  });
});

describe("bloqueo por usuario", () => {
  it("5 fallos bloquean 15 minutos: ni la contraseña correcta entra; queda en auditoría con la cuenta", async () => {
    const { userId } = await crear();
    for (let i = 0; i < LIMITES_INGRESO.maxFallidos; i++) expect((await ingresar(USUARIO, MAL)).status).toBe(401);

    const bloqueado = await ingresar();
    expect(bloqueado.status).toBe(429);
    expect(bloqueado.cuerpo).toMatchObject({ message: MENSAJE_BLOQUEO });
    expect(bloqueado.cookies.some((c) => c.includes("session_token=") && !c.includes("session_token=;"))).toBe(false);

    const hasta = await bloqueadoHasta(db(), USUARIO);
    expect(hasta).not.toBeNull();
    const minutos = (hasta!.getTime() - Date.now()) / 60_000;
    expect(minutos).toBeGreaterThan(14);
    expect(minutos).toBeLessThanOrEqual(15);

    const [evento] = await acciones("sesion.bloqueada");
    expect(evento).toMatchObject({ ip: "203.0.113.7", detalle: { usuario_id: userId } });
    expect(JSON.stringify(evento)).not.toContain(MAL);
  });

  it("vencido el bloqueo, la contraseña correcta entra y el contador vuelve a cero", async () => {
    await crear();
    for (let i = 0; i < 5; i++) await ingresar(USUARIO, MAL);
    expect((await ingresar()).status).toBe(429);
    await db().updateTable("intento_ingreso").set({ bloqueado_hasta: new Date(Date.now() - 1000) }).execute();
    expect((await ingresar()).status).toBe(200);
    expect(await db().selectFrom("intento_ingreso").selectAll().execute()).toHaveLength(0);
  });

  it("un usuario inexistente se bloquea igual y recibe exactamente la misma respuesta", async () => {
    await crear();
    for (let i = 0; i < 5; i++) {
      const [real, inventado] = [await ingresar(USUARIO, MAL), await ingresar("noexiste", MAL)];
      expect([inventado.status, inventado.cuerpo]).toEqual([real.status, real.cuerpo]);
    }
    const [real, inventado] = [await ingresar(), await ingresar("noexiste", CONTRASENA)];
    expect(real.status).toBe(429);
    expect([inventado.status, inventado.cuerpo]).toEqual([real.status, real.cuerpo]);
    expect((await acciones("sesion.bloqueada")).map((e) => (e.detalle as { usuario_id: string }).usuario_id)).toContain("desconocido");
  });

  it("no distingue mayúsculas ni espacios, y un ingreso correcto reinicia la cuenta", async () => {
    await crear();
    for (let i = 0; i < 4; i++) await ingresar(i % 2 ? " FTOBONC " : USUARIO, MAL);
    expect((await ingresar()).status).toBe(200);
    for (let i = 0; i < 4; i++) expect((await ingresar(USUARIO, MAL)).status).toBe(401);
    expect((await ingresar()).status).toBe(200);
  });

  it("los fallos fuera de la ventana de 15 minutos no se acumulan", async () => {
    const t0 = new Date("2026-10-08T15:00:00Z");
    for (let i = 0; i < 4; i++) await registrarFallo(db(), "alguien", t0);
    // 16 minutos después el conteo empieza de nuevo: el quinto fallo no bloquea.
    expect(await registrarFallo(db(), "alguien", new Date(t0.getTime() + 16 * 60_000))).toBeNull();
    for (let i = 0; i < 3; i++) await registrarFallo(db(), "alguien", new Date(t0.getTime() + 17 * 60_000));
    expect(await registrarFallo(db(), "alguien", new Date(t0.getTime() + 18 * 60_000))).toEqual(new Date(t0.getTime() + 33 * 60_000));
  });

  it("un admin puede desbloquear antes de tiempo, y queda en auditoría", async () => {
    const { userId: admin } = await crear("admin1");
    const { userId } = await crear(USUARIO, "asistente");
    for (let i = 0; i < 5; i++) await ingresar(USUARIO, MAL);
    expect(await bloqueadoHasta(db(), USUARIO)).not.toBeNull();
    expect(await desbloquearIngreso(db(), userId, { userId: admin })).toBe(true);
    expect((await ingresar()).status).toBe(200);
    expect(await acciones("usuario.desbloqueado")).toMatchObject([{ actor_id: admin, entidad_id: userId, detalle: { estaba_bloqueado: true } }]);
  });
});

describe("sesión", () => {
  it("vence tras 8 horas sin actividad y se renueva con actividad (como máximo cada 15 minutos)", async () => {
    expect(auth().options.session).toMatchObject({ expiresIn: 8 * 60 * 60, updateAge: 15 * 60 });
    await crear();
    const { cookie } = await ingresar();
    expect((await estado(cookie)).tipo).toBe("autorizado");

    // Actividad tras 16 minutos: el vencimiento se corre a 8 horas desde ahora.
    const casiVencida = new Date(Date.now() + SESION.inactividadSeg * 1000 - 16 * 60_000);
    await db().updateTable("session").set({ expiresAt: casiVencida }).execute();
    expect((await estado(cookie)).tipo).toBe("autorizado");
    const renovada = await db().selectFrom("session").select("expiresAt").executeTakeFirstOrThrow();
    expect(new Date(renovada.expiresAt).getTime()).toBeGreaterThan(casiVencida.getTime() + 10 * 60_000);

    // Sin actividad hasta pasar el vencimiento: ya no hay sesión.
    await db().updateTable("session").set({ expiresAt: new Date(Date.now() - 1000) }).execute();
    expect((await estado(cookie)).tipo).toBe("sin_sesion");
  });

  it("nunca dura más de 12 horas aunque haya actividad", async () => {
    const { userId } = await crear();
    const { cookie } = await ingresar();
    const sesion = await db().selectFrom("session").select("createdAt").executeTakeFirstOrThrow();
    const creada = new Date(sesion.createdAt);
    expect((await estado(cookie, new Date(creada.getTime() + 11.9 * 60 * 60_000))).tipo).toBe("autorizado");
    expect((await estado(cookie, new Date(creada.getTime() + 12 * 60 * 60_000 + 60_000))).tipo).toBe("sin_sesion");
    expect(await db().selectFrom("session").selectAll().execute()).toHaveLength(0);
    expect(await acciones("sesion.tope_alcanzado")).toMatchObject([{ actor_id: userId }]);
  });
});

describe("segundo factor opcional", () => {
  it("se activa y desactiva desde Mi cuenta, con auditoría; activo, el ingreso pide el código", async () => {
    const { userId } = await crear();
    const { cookie } = await ingresar();
    const activar = await llamar(auth(), "/two-factor/enable", { password: CONTRASENA }, cookie);
    const { totpURI } = activar.cuerpo as { totpURI: string };
    const verificar = await llamar(auth(), "/two-factor/verify-totp", { code: codigoTotp(totpURI) }, cookie);
    expect(verificar.status).toBe(200);
    const conSesion = unirCookies(cookie, verificar.cookies);
    expect(await acciones("segundo_factor.activado")).toMatchObject([{ actor_id: userId }]);

    const paso1 = await ingresar();
    expect(paso1.cuerpo).toMatchObject({ twoFactorRedirect: true });
    // El paso de código de un ingreso no cuenta como activación.
    await llamar(auth(), "/two-factor/verify-totp", { code: codigoTotp(totpURI) }, paso1.cookie);
    expect(await acciones("segundo_factor.activado")).toHaveLength(1);

    expect((await llamar(auth(), "/two-factor/disable", { password: MAL }, conSesion)).status).toBeGreaterThanOrEqual(400);
    expect((await llamar(auth(), "/two-factor/disable", { password: CONTRASENA }, conSesion)).status).toBe(200);
    expect(await acciones("segundo_factor.desactivado")).toMatchObject([{ actor_id: userId }]);
    const sinCodigo = await ingresar();
    expect(sinCodigo.cuerpo).not.toHaveProperty("twoFactorRedirect");
    expect((await estado(sinCodigo.cookie)).tipo).toBe("autorizado");
  });
});
