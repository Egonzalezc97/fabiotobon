import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { auth, crearAuth } from "@/lib/auth";
import { evaluarAcceso } from "@/lib/auth/acceso";
import { cambiarContrasena, crearUsuarioAdmin, reiniciarSegundoFactor } from "@/lib/auth/usuarios";
import { cerrarDb, db } from "@/lib/db";
import { codigoTotp, headersConCookie, limpiarDatos, llamar, unirCookies } from "./ayudas";

const CORREO = "admin@prueba.test";
const CONTRASENA = "una-contrasena-larga-de-prueba";

afterAll(cerrarDb);
beforeEach(() => limpiarDatos(db()));

async function ingresar(correo = CORREO, contrasena = CONTRASENA) {
  const r = await llamar(auth(), "/sign-in/email", { email: correo, password: contrasena });
  return { ...r, cookie: unirCookies(undefined, r.cookies) };
}

async function estado(cookie?: string) {
  return evaluarAcceso(auth(), db(), cookie ? headersConCookie(cookie) : new Headers());
}

/** Crea el admin, ingresa y activa el segundo factor. Devuelve la URI TOTP. */
async function adminConSegundoFactor() {
  await crearUsuarioAdmin(auth(), db(), { correo: CORREO, nombre: "Admin", contrasena: CONTRASENA });
  const { cookie } = await ingresar();
  const activar = await llamar(auth(), "/two-factor/enable", { password: CONTRASENA }, cookie);
  expect(activar.status).toBe(200);
  const { totpURI } = activar.cuerpo as { totpURI: string };
  const verificar = await llamar(auth(), "/two-factor/verify-totp", { code: codigoTotp(totpURI) }, cookie);
  expect(verificar.status).toBe(200);
  return { totpURI };
}

describe("acceso al panel", () => {
  it("sin sesión no entra", async () => {
    expect(await estado()).toEqual({ tipo: "sin_sesion" });
  });

  it("con contraseña correcta pero sin segundo factor activado, se le exige activarlo", async () => {
    await crearUsuarioAdmin(auth(), db(), { correo: CORREO, nombre: "Admin", contrasena: CONTRASENA });
    const { status, cookie } = await ingresar();
    expect(status).toBe(200);
    expect((await estado(cookie)).tipo).toBe("sin_segundo_factor");
  });

  it("una cuenta sin fila en `usuario` no entra aunque tenga sesión", async () => {
    const ctx = await auth().$context;
    const user = await ctx.internalAdapter.createUser(
      { email: "otro@prueba.test", name: "Otro", emailVerified: true },
      { method: "admin" },
    );
    await ctx.internalAdapter.linkAccount({
      userId: user.id,
      providerId: "credential",
      accountId: user.id,
      password: await ctx.password.hash(CONTRASENA),
    });
    const { cookie } = await ingresar("otro@prueba.test");
    expect((await estado(cookie)).tipo).toBe("sin_permiso");

    const denegado = await db().selectFrom("auditoria").selectAll().where("accion", "=", "panel.acceso_denegado").execute();
    expect(denegado).toHaveLength(1);
  });

  it("un usuario desactivado no entra", async () => {
    const { userId } = await crearUsuarioAdmin(auth(), db(), { correo: CORREO, nombre: "Admin", contrasena: CONTRASENA });
    await db().updateTable("usuario").set({ activo: false }).where("user_id", "=", userId).execute();
    const { cookie } = await ingresar();
    expect((await estado(cookie)).tipo).toBe("sin_permiso");
  });

  it("con segundo factor activado, la contraseña sola no abre sesión: hace falta el código", async () => {
    const { totpURI } = await adminConSegundoFactor();

    const paso1 = await ingresar();
    expect(paso1.status).toBe(200);
    expect(paso1.cuerpo).toMatchObject({ twoFactorRedirect: true });
    expect(await estado(paso1.cookie)).toEqual({ tipo: "sin_sesion" });

    const malo = await llamar(auth(), "/two-factor/verify-totp", { code: "000000" }, paso1.cookie);
    expect(malo.status).toBeGreaterThanOrEqual(400);

    const paso2 = await llamar(auth(), "/two-factor/verify-totp", { code: codigoTotp(totpURI) }, paso1.cookie);
    expect(paso2.status).toBe(200);
    const final = await estado(unirCookies(paso1.cookie, paso2.cookies));
    expect(final).toMatchObject({ tipo: "admin", admin: { correo: CORREO, rol: "admin" } });
  });
});

describe("cuentas", () => {
  it("no existe registro público", async () => {
    const r = await llamar(auth(), "/sign-up/email", { email: "intruso@prueba.test", password: CONTRASENA, name: "X" });
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(await db().selectFrom("user").selectAll().execute()).toHaveLength(0);
  });

  it("exige contraseñas de al menos 12 caracteres y correos válidos", async () => {
    await expect(
      crearUsuarioAdmin(auth(), db(), { correo: CORREO, nombre: "Admin", contrasena: "corta" }),
    ).rejects.toThrow(/12 caracteres/);
    await expect(
      crearUsuarioAdmin(auth(), db(), { correo: "no-es-correo", nombre: "Admin", contrasena: CONTRASENA }),
    ).rejects.toThrow(/Correo inválido/);
  });

  it("no crea dos cuentas con el mismo correo (sin importar mayúsculas)", async () => {
    await crearUsuarioAdmin(auth(), db(), { correo: CORREO, nombre: "Admin", contrasena: CONTRASENA });
    await expect(
      crearUsuarioAdmin(auth(), db(), { correo: CORREO.toUpperCase(), nombre: "Admin", contrasena: CONTRASENA }),
    ).rejects.toThrow(/Ya existe/);
  });

  it("cambiar la contraseña cierra las sesiones abiertas y la anterior deja de servir", async () => {
    await crearUsuarioAdmin(auth(), db(), { correo: CORREO, nombre: "Admin", contrasena: CONTRASENA });
    const { cookie } = await ingresar();
    expect((await estado(cookie)).tipo).toBe("sin_segundo_factor");

    await cambiarContrasena(auth(), db(), { correo: CORREO, contrasena: "otra-contrasena-larga-nueva" });

    expect((await estado(cookie)).tipo).toBe("sin_sesion");
    expect((await ingresar()).status).toBeGreaterThanOrEqual(400);
    expect((await ingresar(CORREO, "otra-contrasena-larga-nueva")).status).toBe(200);
  });
});

describe("auditoría de ingresos", () => {
  it("registra ingresos exitosos y fallidos, sin guardar el correo ni la contraseña intentados", async () => {
    await crearUsuarioAdmin(auth(), db(), { correo: CORREO, nombre: "Admin", contrasena: CONTRASENA });
    await ingresar(CORREO, "contrasena-equivocada-123");
    await ingresar();

    const filas = await db().selectFrom("auditoria").selectAll().orderBy("id").execute();
    expect(filas.map((f) => f.accion)).toEqual(["usuario.creado", "sesion.fallida", "sesion.iniciada"]);

    const fallida = filas[1];
    expect(fallida).toMatchObject({ actor_tipo: "anonimo", ip: "203.0.113.7", user_agent: "vitest" });
    const serializado = JSON.stringify(filas);
    expect(serializado).not.toContain("contrasena-equivocada-123");
    expect(serializado).not.toContain(CONTRASENA);
    expect(JSON.stringify(fallida)).not.toContain(CORREO);
  });

  it("con segundo factor, la contraseña sola no cuenta como ingreso; el código correcto sí", async () => {
    const { totpURI } = await adminConSegundoFactor();
    const contarIngresos = async () =>
      (await db().selectFrom("auditoria").select("id").where("accion", "=", "sesion.iniciada").execute()).length;
    const antes = await contarIngresos();

    const paso1 = await ingresar();
    expect(await contarIngresos()).toBe(antes);

    await llamar(auth(), "/two-factor/verify-totp", { code: "000000" }, paso1.cookie);
    expect(await contarIngresos()).toBe(antes);

    await llamar(auth(), "/two-factor/verify-totp", { code: codigoTotp(totpURI) }, paso1.cookie);
    expect(await contarIngresos()).toBe(antes + 1);

    const fallidas = await db()
      .selectFrom("auditoria")
      .select("detalle")
      .where("accion", "=", "sesion.fallida")
      .execute();
    expect(fallidas.map((f) => f.detalle)).toContainEqual(
      expect.objectContaining({ ruta: "/two-factor/verify-totp" }),
    );
  });
});

describe("límite de intentos", () => {
  it("registra en auditoría los rechazos por límite (429) sin guardar el correo", async () => {
    await crearUsuarioAdmin(auth(), db(), { correo: CORREO, nombre: "Admin", contrasena: CONTRASENA });
    // Instancia propia con el limitador activo (en pruebas va apagado para no interferir con el resto).
    const conLimite = crearAuth({
      db: db(),
      secret: "secreto-solo-para-pruebas-automatizadas-0123456789",
      baseURL: "http://localhost:3000",
      limitarIntentos: true,
    });
    const estados: number[] = [];
    for (let i = 0; i < 7; i++) {
      estados.push((await llamar(conLimite, "/sign-in/email", { email: CORREO, password: "equivocada-xxxxxxx" })).status);
    }
    expect(estados.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
    expect(estados.slice(5)).toEqual([429, 429]);

    const limitadas = await db().selectFrom("auditoria").selectAll().where("accion", "=", "sesion.limitada").execute();
    expect(limitadas).toHaveLength(2);
    expect(limitadas[0]).toMatchObject({ actor_tipo: "anonimo", ip: "203.0.113.7", detalle: { ruta: "/sign-in/email" } });
    expect(JSON.stringify(limitadas)).not.toContain(CORREO);
  });
});

describe("reinicio del segundo factor", () => {
  it("borra el segundo factor, cierra las sesiones, obliga a activarlo de nuevo y queda en auditoría", async () => {
    await adminConSegundoFactor();
    const sesionPrevia = await ingresar();
    expect(sesionPrevia.cuerpo).toMatchObject({ twoFactorRedirect: true });

    await reiniciarSegundoFactor(auth(), db(), { correo: CORREO, motivo: "Perdió el celular" });

    expect(await db().selectFrom("twoFactor").selectAll().execute()).toHaveLength(0);
    expect(await db().selectFrom("session").selectAll().execute()).toHaveLength(0);

    const nuevo = await ingresar();
    expect(nuevo.cuerpo).not.toHaveProperty("twoFactorRedirect");
    expect((await estado(nuevo.cookie)).tipo).toBe("sin_segundo_factor");

    const registro = await db()
      .selectFrom("auditoria")
      .selectAll()
      .where("accion", "=", "usuario.segundo_factor_reiniciado")
      .executeTakeFirstOrThrow();
    expect(registro).toMatchObject({ actor_tipo: "sistema", entidad: "usuario", detalle: { motivo: "Perdió el celular" } });
  });

  it("exige un motivo y una cuenta existente", async () => {
    await expect(reiniciarSegundoFactor(auth(), db(), { correo: CORREO, motivo: "x" })).rejects.toThrow(/motivo/);
    await expect(
      reiniciarSegundoFactor(auth(), db(), { correo: "nadie@prueba.test", motivo: "Perdió el celular" }),
    ).rejects.toThrow(/No existe/);
  });
});
