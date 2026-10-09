import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { auth, crearAuth } from "@/lib/auth";
import { evaluarAcceso, rolPermitido } from "@/lib/auth/acceso";
import {
  cambiarActivo,
  cambiarContrasena,
  cambiarContrasenaPropia,
  cambiarRol,
  correoReal,
  crearUsuario,
  forzarCambioContrasena,
  listarUsuarios,
  nombreUsuarioDisponible,
  reiniciarSegundoFactor,
  sugerirNombreUsuario,
  type DatosNuevoUsuario,
} from "@/lib/auth/usuarios";
import { cerrarDb, db } from "@/lib/db";
import { codigoTotp, headersConCookie, limpiarDatos, llamar, unirCookies } from "./ayudas";

const USUARIO = "ftobonc";
const CONTRASENA = "una-contrasena-larga-de-prueba";

afterAll(cerrarDb);
beforeEach(() => limpiarDatos(db()));

function datos(cambios: Partial<DatosNuevoUsuario> = {}): DatosNuevoUsuario {
  return { nombre: "Fabio Tobón Casas", usuario: USUARIO, correo: "fabio@prueba.test", rol: "admin", contrasena: CONTRASENA, temporal: false, ...cambios };
}

async function ingresar(usuario = USUARIO, contrasena = CONTRASENA) {
  const r = await llamar(auth(), "/sign-in/username", { username: usuario, password: contrasena });
  return { ...r, cookie: unirCookies(undefined, r.cookies) };
}

async function estado(cookie?: string) {
  return evaluarAcceso(auth(), db(), cookie ? headersConCookie(cookie) : new Headers());
}

/** Ingresa y activa el segundo factor de una cuenta ya creada. Devuelve la URI TOTP y la cookie final. */
async function activarSegundoFactor(usuario = USUARIO) {
  const { cookie } = await ingresar(usuario);
  const activar = await llamar(auth(), "/two-factor/enable", { password: CONTRASENA }, cookie);
  expect(activar.status).toBe(200);
  const { totpURI } = activar.cuerpo as { totpURI: string };
  const verificar = await llamar(auth(), "/two-factor/verify-totp", { code: codigoTotp(totpURI) }, cookie);
  expect(verificar.status).toBe(200);
  return { totpURI, cookie: unirCookies(cookie, verificar.cookies) };
}

describe("nombre de usuario", () => {
  it("sugiere inicial del nombre + primer apellido + inicial del segundo apellido, sin tildes", () => {
    expect(sugerirNombreUsuario("Fabio Tobón Casas")).toBe("ftobonc");
    expect(sugerirNombreUsuario("Esteban González C.")).toBe("egonzalezc");
    expect(sugerirNombreUsuario("María José Pérez Gómez")).toBe("mperezg");
    expect(sugerirNombreUsuario("Fabio Tobón")).toBe("ftobon");
    expect(sugerirNombreUsuario("  Ñandú  ")).toBe("nandu");
  });

  it("agrega un número si ya existe", async () => {
    await crearUsuario(auth(), db(), datos(), null);
    expect(await nombreUsuarioDisponible(db(), "ftobonc")).toBe("ftobonc2");
    await crearUsuario(auth(), db(), datos({ usuario: "ftobonc2", correo: null }), null);
    expect(await nombreUsuarioDisponible(db(), "ftobonc")).toBe("ftobonc3");
  });

  it("es único sin distinguir mayúsculas y valida el formato", async () => {
    await crearUsuario(auth(), db(), datos(), null);
    await expect(crearUsuario(auth(), db(), datos({ usuario: "FTobonC", correo: null }), null)).rejects.toThrow(/ya existe/);
    for (const malo of ["ab", "con espacio", "ñandu", "x".repeat(31), "guion-medio"]) {
      await expect(crearUsuario(auth(), db(), datos({ usuario: malo, correo: null }), null)).rejects.toThrow(/3 a 30/);
    }
  });

  it("el correo es opcional: sin correo se guarda una dirección interna que no se muestra", async () => {
    await crearUsuario(auth(), db(), datos({ correo: null }), null);
    const [u] = await listarUsuarios(db());
    expect(u?.correo).toBeNull();
    const fila = await db().selectFrom("user").select("email").executeTakeFirstOrThrow();
    expect(fila.email).toMatch(/@sin-correo\.invalid$/);
    expect(correoReal(fila.email)).toBeNull();
  });
});

describe("ingreso y acceso al panel", () => {
  it("se ingresa con el nombre de usuario (sin importar mayúsculas); el correo ya no sirve", async () => {
    await crearUsuario(auth(), db(), datos(), null);
    expect((await ingresar("FTOBONC")).status).toBe(200);
    const porCorreo = await llamar(auth(), "/sign-in/email", { email: "fabio@prueba.test", password: CONTRASENA });
    expect(porCorreo.status).toBeGreaterThanOrEqual(400);
  });

  it("sin sesión no entra; sin segundo factor (opcional) basta la contraseña", async () => {
    expect(await estado()).toEqual({ tipo: "sin_sesion" });
    await crearUsuario(auth(), db(), datos(), null);
    const r = await ingresar();
    expect(r.cuerpo).not.toHaveProperty("twoFactorRedirect");
    expect((await estado(r.cookie)).tipo).toBe("autorizado");
  });

  it("una cuenta sin fila en `usuario` o desactivada no entra", async () => {
    const ctx = await auth().$context;
    const user = await ctx.internalAdapter.createUser({ email: "otro@prueba.test", name: "Otro", emailVerified: true, username: "otro" }, { method: "admin" });
    await ctx.internalAdapter.linkAccount({ userId: user.id, providerId: "credential", accountId: user.id, password: await ctx.password.hash(CONTRASENA) });
    expect((await estado((await ingresar("otro")).cookie)).tipo).toBe("sin_permiso");

    const { userId } = await crearUsuario(auth(), db(), datos(), null);
    await db().updateTable("usuario").set({ activo: false }).where("user_id", "=", userId).execute();
    expect((await estado((await ingresar()).cookie)).tipo).toBe("sin_permiso");
  });

  it("con segundo factor, la contraseña sola no abre sesión: hace falta el código", async () => {
    await crearUsuario(auth(), db(), datos(), null);
    const { totpURI } = await activarSegundoFactor();
    const paso1 = await ingresar();
    expect(paso1.cuerpo).toMatchObject({ twoFactorRedirect: true });
    expect(await estado(paso1.cookie)).toEqual({ tipo: "sin_sesion" });
    const paso2 = await llamar(auth(), "/two-factor/verify-totp", { code: codigoTotp(totpURI) }, paso1.cookie);
    expect(await estado(unirCookies(paso1.cookie, paso2.cookies))).toMatchObject({
      tipo: "autorizado",
      usuario: { usuario: USUARIO, rol: "admin", nombre: "Fabio Tobón Casas" },
    });
  });

  it("con contraseña temporal: primero cambiarla y después entra (sin exigir segundo factor)", async () => {
    await crearUsuario(auth(), db(), datos({ temporal: true }), null);
    const { cookie } = await ingresar();
    const e = await estado(cookie);
    expect(e.tipo).toBe("debe_cambiar_contrasena");
    if (e.tipo !== "debe_cambiar_contrasena") throw new Error();

    await expect(
      cambiarContrasenaPropia(auth(), db(), headersConCookie(cookie), { actual: "equivocada-1234567", nueva: "nueva-contrasena-propia" }, e.userId),
    ).rejects.toThrow(/actual no es correcta/);
    await cambiarContrasenaPropia(auth(), db(), headersConCookie(cookie), { actual: CONTRASENA, nueva: "nueva-contrasena-propia" }, e.userId);
    expect((await estado((await ingresar(USUARIO, "nueva-contrasena-propia")).cookie)).tipo).toBe("autorizado");
    expect((await ingresar()).status).toBeGreaterThanOrEqual(400);
  });

  it("el rol decide el alcance: el asistente no tiene permisos de admin", () => {
    expect(rolPermitido("asistente", ["admin", "asistente"])).toBe(true);
    expect(rolPermitido("asistente", ["admin"])).toBe(false);
    expect(rolPermitido("admin", ["admin"])).toBe(true);
  });
});

describe("gestión de usuarios", () => {
  it("siempre queda al menos un admin activo", async () => {
    const { userId: unico } = await crearUsuario(auth(), db(), datos(), null);
    await expect(cambiarRol(db(), unico, "asistente", { userId: unico })).rejects.toThrow(/al menos un administrador/);
    await expect(cambiarActivo(db(), unico, false, { userId: unico })).rejects.toThrow(/al menos un administrador/);

    const { userId: otro } = await crearUsuario(auth(), db(), datos({ usuario: "egonzalezc", nombre: "Esteban González C.", correo: null }), null);
    await cambiarRol(db(), unico, "asistente", { userId: otro });
    expect((await listarUsuarios(db())).find((u) => u.userId === unico)?.rol).toBe("asistente");
  });

  it("dos admins desactivándose a la vez no dejan el panel sin admin", async () => {
    const { userId: a } = await crearUsuario(auth(), db(), datos(), null);
    const { userId: b } = await crearUsuario(auth(), db(), datos({ usuario: "egonzalezc", nombre: "Esteban González C.", correo: null }), null);
    const resultados = await Promise.allSettled([cambiarActivo(db(), a, false, { userId: a }), cambiarActivo(db(), b, false, { userId: b })]);
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const activos = (await listarUsuarios(db())).filter((u) => u.rol === "admin" && u.activo);
    expect(activos).toHaveLength(1);
  });

  it("desactivar cierra sus sesiones; forzar cambio pone contraseña temporal y la exige", async () => {
    const { userId: admin } = await crearUsuario(auth(), db(), datos(), null);
    const { userId: asistente } = await crearUsuario(auth(), db(), datos({ usuario: "asis", nombre: "Asistente Uno", rol: "asistente", correo: null }), null);
    const { cookie } = await ingresar("asis");
    await cambiarActivo(db(), asistente, false, { userId: admin });
    expect((await estado(cookie)).tipo).toBe("sin_sesion");
    await cambiarActivo(db(), asistente, true, { userId: admin });

    await forzarCambioContrasena(auth(), db(), asistente, "temporal-nueva-123", { userId: admin });
    expect((await ingresar("asis")).status).toBeGreaterThanOrEqual(400);
    expect((await estado((await ingresar("asis", "temporal-nueva-123")).cookie)).tipo).toBe("debe_cambiar_contrasena");
  });

  it("cada acción queda en auditoría con quién la hizo", async () => {
    const { userId: admin } = await crearUsuario(auth(), db(), datos(), null);
    const yo = { userId: admin };
    const { userId: asis } = await crearUsuario(auth(), db(), datos({ usuario: "asis", nombre: "Asistente Uno", rol: "asistente", correo: null }), yo);
    await cambiarRol(db(), asis, "admin", yo);
    await cambiarActivo(db(), asis, false, yo);
    await forzarCambioContrasena(auth(), db(), asis, "temporal-nueva-123", yo);
    await reiniciarSegundoFactor(db(), { userId: asis, motivo: "Perdió el celular" }, yo);
    const filas = await db().selectFrom("auditoria").select(["accion", "actor_id", "entidad_id"]).where("entidad_id", "=", asis).orderBy("id").execute();
    expect(filas.map((f) => f.accion)).toEqual([
      "usuario.creado",
      "usuario.rol_cambiado",
      "usuario.desactivado",
      "usuario.cambio_contrasena_forzado",
      "usuario.segundo_factor_reiniciado",
    ]);
    expect(filas.every((f) => f.actor_id === admin)).toBe(true);
  });

  it("no existe registro público", async () => {
    const r = await llamar(auth(), "/sign-up/email", { email: "intruso@prueba.test", password: CONTRASENA, name: "X" });
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(await db().selectFrom("user").selectAll().execute()).toHaveLength(0);
  });

  it("exige contraseñas de al menos 12 caracteres y correos válidos", async () => {
    await expect(crearUsuario(auth(), db(), datos({ contrasena: "corta" }), null)).rejects.toThrow(/12 caracteres/);
    await expect(crearUsuario(auth(), db(), datos({ correo: "no-es-correo" }), null)).rejects.toThrow(/Correo inválido/);
  });

  it("cambiar la contraseña por consola cierra las sesiones y la anterior deja de servir", async () => {
    await crearUsuario(auth(), db(), datos(), null);
    const { cookie } = await ingresar();
    await cambiarContrasena(auth(), db(), { usuario: USUARIO, contrasena: "otra-contrasena-larga-nueva" });
    expect((await estado(cookie)).tipo).toBe("sin_sesion");
    expect((await ingresar()).status).toBeGreaterThanOrEqual(400);
    expect((await ingresar(USUARIO, "otra-contrasena-larga-nueva")).status).toBe(200);
  });
});

describe("auditoría de ingresos", () => {
  it("registra ingresos exitosos y fallidos con la cuenta, la IP y la fecha, sin guardar lo escrito", async () => {
    const { userId } = await crearUsuario(auth(), db(), datos(), null);
    await ingresar(USUARIO, "contrasena-equivocada-123");
    await ingresar("alguien-que-no-existe", "contrasena-equivocada-123");
    await ingresar();
    const filas = await db().selectFrom("auditoria").selectAll().orderBy("id").execute();
    expect(filas.map((f) => f.accion)).toEqual(["usuario.creado", "sesion.fallida", "sesion.fallida", "sesion.iniciada"]);
    expect(filas[1]).toMatchObject({ actor_tipo: "anonimo", ip: "203.0.113.7", user_agent: "vitest", detalle: { usuario_id: userId } });
    expect(filas[2]).toMatchObject({ detalle: { usuario_id: "desconocido" } });
    expect(filas[3]).toMatchObject({ actor_id: userId, ip: "203.0.113.7" });
    for (const f of filas.slice(1)) expect(f.ocurrido_en).toBeTruthy();
    const serializado = JSON.stringify(filas.slice(1));
    expect(serializado).not.toContain("contrasena-equivocada-123");
    expect(serializado).not.toContain(CONTRASENA);
    expect(serializado).not.toContain("alguien-que-no-existe");
    expect(JSON.stringify(filas.slice(1, 3))).not.toContain(USUARIO);
  });

  it("con segundo factor, la contraseña sola no cuenta como ingreso; el código correcto sí", async () => {
    await crearUsuario(auth(), db(), datos(), null);
    const { totpURI } = await activarSegundoFactor();
    const contar = async () => (await db().selectFrom("auditoria").select("id").where("accion", "=", "sesion.iniciada").execute()).length;
    const antes = await contar();
    const paso1 = await ingresar();
    expect(await contar()).toBe(antes);
    await llamar(auth(), "/two-factor/verify-totp", { code: codigoTotp(totpURI) }, paso1.cookie);
    expect(await contar()).toBe(antes + 1);
  });
});

describe("límite de intentos por IP", () => {
  it("10 intentos cada 5 minutos por IP, contados en la base; los rechazos (429) quedan en auditoría", async () => {
    await crearUsuario(auth(), db(), datos(), null);
    const conLimite = crearAuth({ db: db(), secret: "secreto-solo-para-pruebas-automatizadas-0123456789", baseURL: "http://localhost:3000", limitarIntentos: true });
    const estados: number[] = [];
    // Un nombre distinto en cada intento: aquí actúa el límite por IP, no el bloqueo por usuario.
    for (let i = 0; i < 12; i++) {
      estados.push((await llamar(conLimite, "/sign-in/username", { username: `usuario${i}`, password: "equivocada-xxxxxxx" })).status);
    }
    expect(estados.slice(0, 10)).toEqual(Array(10).fill(401));
    expect(estados.slice(10)).toEqual([429, 429]);
    // El contador vive en la base (sobrevive a un reinicio del servidor).
    expect((await db().selectFrom("rateLimit").selectAll().execute()).length).toBeGreaterThan(0);
    const limitadas = await db().selectFrom("auditoria").selectAll().where("accion", "=", "sesion.limitada").execute();
    expect(limitadas).toHaveLength(2);
    expect(limitadas[0]).toMatchObject({ actor_tipo: "anonimo", ip: "203.0.113.7", detalle: { ruta: "/sign-in/username" } });
  });
});

describe("reinicio del segundo factor", () => {
  it("borra el segundo factor y cierra las sesiones; después entra solo con la contraseña", async () => {
    await crearUsuario(auth(), db(), datos(), null);
    await activarSegundoFactor();
    await reiniciarSegundoFactor(db(), { usuario: USUARIO, motivo: "Perdió el celular" });
    expect(await db().selectFrom("twoFactor").selectAll().execute()).toHaveLength(0);
    expect(await db().selectFrom("session").selectAll().execute()).toHaveLength(0);
    const nuevo = await ingresar();
    expect(nuevo.cuerpo).not.toHaveProperty("twoFactorRedirect");
    expect((await estado(nuevo.cookie)).tipo).toBe("autorizado");
  });

  it("exige un motivo y una cuenta existente", async () => {
    await expect(reiniciarSegundoFactor(db(), { usuario: USUARIO, motivo: "x" })).rejects.toThrow(/motivo/);
    await expect(reiniciarSegundoFactor(db(), { usuario: "nadie", motivo: "Perdió el celular" })).rejects.toThrow(/No existe/);
  });
});
