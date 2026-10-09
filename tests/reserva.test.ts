import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { sql } from "kysely";
import { cerrarDb, db } from "@/lib/db";
import { emisorDesarrollo, EmisorNoPermitido, obtenerEmisor, type EmisorCodigo } from "@/lib/verificacion";
import { crearCita, resolverRevisionVinculando, RevisionNoPendiente } from "@/modules/agenda/citas";
import { contarPendientesDeRevisar } from "@/modules/agenda/consultas";
import {
  completarReserva,
  cuposPublicos,
  estadoReservaPublica,
  iniciarReserva,
  LIMITES,
  reenviarCodigo,
  resumenReservaCompletada,
  verificarCodigo,
  type Contexto,
  type DatosReserva,
} from "@/modules/agenda/reserva-publica";
import { instante } from "@/modules/agenda/tiempo";
import { limpiarDatos } from "./ayudas";

afterAll(cerrarDb);
beforeEach(() => limpiarDatos(db()));

const LUNES = "2026-11-02";
const AHORA = new Date("2026-10-27T15:00:00Z");
const h = (hora: string) => {
  const [hh = "0", mm = "0"] = hora.split(":");
  return instante(LUNES, Number(hh) * 60 + Number(mm));
};
const TEXTO = { version: "v1-prueba", texto: "Autorizo el tratamiento de mis datos personales para agendar mi cita. Texto de prueba.", demostracion: false };

function ctx(cambios: Partial<Contexto> = {}): Contexto {
  return { ip: "203.0.113.10", userAgent: "vitest", ahora: AHORA, secreto: process.env.VERIFICACION_SECRET!, ...cambios };
}

/** Emisor falso que guarda el último código por celular. */
function emisorFalso() {
  const codigos = new Map<string, string>();
  const enviados: string[] = [];
  const emisor: EmisorCodigo = {
    nombre: "prueba",
    async enviar(celular, codigo) {
      codigos.set(celular, codigo);
      enviados.push(celular);
    },
  };
  return { emisor, codigos, enviados };
}

const entorno = (emisor: EmisorCodigo | null) => ({ emisor, produccion: false });

async function escenario() {
  const servicio = await db()
    .insertInto("servicio")
    .values({ slug: "valoracion", nombre: "Valoración", duracion_min: 30, politica_reserva: "publico" })
    .returning("id")
    .executeTakeFirstOrThrow();
  await db()
    .insertInto("horario_laboral")
    .values([1, 2, 3, 4, 5].map((d) => ({ dia_semana: d, hora_inicio: "08:00", hora_fin: "12:00" })))
    .execute();
  await db().insertInto("texto_autorizacion").values(TEXTO).execute();
  const existente = await db()
    .insertInto("paciente")
    .values({ tipo_documento: "CC", numero_documento: "52000111", nombre: "Paciente Existente", celular: "+573001110000" })
    .returning("id")
    .executeTakeFirstOrThrow();
  return { servicioId: servicio.id, existenteId: existente.id };
}

function datos(servicioId: string, cambios: Partial<DatosReserva> = {}): DatosReserva {
  return {
    servicioId,
    inicio: h("09:00"),
    tipoDocumento: "CC",
    numeroDocumento: "1020304050",
    nombre: "Persona Nueva",
    celular: "300 222 3344",
    correo: "",
    aceptaAutorizacion: true,
    versionAutorizacion: TEXTO.version,
    ...cambios,
  };
}

async function reservar(servicioId: string, cambios: Partial<DatosReserva> = {}, contexto = ctx()) {
  const { emisor, codigos } = emisorFalso();
  const inicio = await iniciarReserva(db(), datos(servicioId, cambios), entorno(emisor), contexto);
  if (!inicio.ok) throw new Error(`no inició: ${inicio.motivo}`);
  const celular = [...codigos.keys()][0]!;
  const resultado = await verificarCodigo(db(), inicio.token, codigos.get(celular)!, contexto);
  return { token: inicio.token, resultado };
}

describe("flujo completo", () => {
  it("documento nuevo: crea ficha con celular verificado, consentimiento con el texto y la cita", async () => {
    const e = await escenario();
    const { token, resultado } = await reservar(e.servicioId);
    expect(resultado.tipo).toBe("creada");

    const paciente = await db()
      .selectFrom("paciente")
      .selectAll()
      .where("numero_documento", "=", "1020304050")
      .executeTakeFirstOrThrow();
    expect(paciente).toMatchObject({ celular: "+573002223344", nombre: "Persona Nueva" });
    expect(paciente.celular_verificado_en).not.toBeNull();

    const cita = await db().selectFrom("cita").selectAll().where("paciente_id", "=", paciente.id).executeTakeFirstOrThrow();
    expect(cita).toMatchObject({ origen: "web", estado: "confirmada", revision: null, vista_en: null });
    expect(cita.inicio.toISOString()).toBe(h("09:00").toISOString());

    const consentimiento = await db().selectFrom("consentimiento").selectAll().executeTakeFirstOrThrow();
    expect(consentimiento).toMatchObject({ paciente_id: paciente.id, cita_id: cita.id, version: TEXTO.version, texto: TEXTO.texto });

    expect(await resumenReservaCompletada(db(), token, AHORA)).toMatchObject({ servicioNombre: "Valoración" });
    expect(await contarPendientesDeRevisar(db())).toEqual({ webNuevas: 1, enRevision: 0 });
  });

  it("el estado inicial de la cita web sale de la configuración (DPF)", async () => {
    const e = await escenario();
    await db().updateTable("configuracion").set({ valor: JSON.stringify("pendiente") }).where("clave", "=", "cita_web_estado_inicial").execute();
    await reservar(e.servicioId);
    expect((await db().selectFrom("cita").select("estado").executeTakeFirstOrThrow()).estado).toBe("pendiente");
  });
});

describe("respuesta uniforme antes de verificar", () => {
  it("documento existente y documento nuevo reciben exactamente la misma respuesta y el mismo trato", async () => {
    const e = await escenario();
    const a = emisorFalso();
    const b = emisorFalso();
    const nuevo = await iniciarReserva(db(), datos(e.servicioId, { celular: "3005550001" }), entorno(a.emisor), ctx());
    const existente = await iniciarReserva(
      db(),
      datos(e.servicioId, { numeroDocumento: "52000111", celular: "3005550002" }),
      entorno(b.emisor),
      ctx({ ip: "203.0.113.11" }),
    );
    expect(Object.keys(nuevo).sort()).toEqual(Object.keys(existente).sort());
    expect(nuevo.ok && existente.ok).toBe(true);
    expect(a.enviados).toHaveLength(1);
    expect(b.enviados).toHaveLength(1);
    // Antes del código no se creó ni se tocó ninguna ficha.
    expect(await db().selectFrom("paciente").select("id").execute()).toHaveLength(1);
  });
});

describe("identidad después de verificar", () => {
  it("documento existente con el mismo celular: se vincula sin modificar la ficha y guarda lo escrito en el evento", async () => {
    const e = await escenario();
    const { resultado } = await reservar(e.servicioId, { numeroDocumento: "52.000.111", celular: "3001110000", nombre: "Otro Nombre" });
    expect(resultado.tipo).toBe("creada");
    const ficha = await db().selectFrom("paciente").selectAll().where("id", "=", e.existenteId).executeTakeFirstOrThrow();
    expect(ficha).toMatchObject({ nombre: "Paciente Existente", celular_verificado_en: null });
    const cita = await db().selectFrom("cita").selectAll().executeTakeFirstOrThrow();
    expect(cita).toMatchObject({ paciente_id: e.existenteId, revision: null });
    const evento = await db().selectFrom("cita_evento").select("detalle").where("cita_id", "=", cita.id).executeTakeFirstOrThrow();
    expect(evento.detalle).toMatchObject({ datos_ingresados: { nombre: "Otro Nombre", celular: "+573001110000" } });
    expect(await db().selectFrom("paciente").select("id").execute()).toHaveLength(1);
  });

  it("documento existente con otro celular: crea la cita sin tocar la ficha y la marca para revisión", async () => {
    const e = await escenario();
    const { resultado } = await reservar(e.servicioId, { numeroDocumento: "52000111", celular: "3009998877" });
    expect(resultado.tipo).toBe("creada");
    const ficha = await db().selectFrom("paciente").selectAll().where("id", "=", e.existenteId).executeTakeFirstOrThrow();
    expect(ficha.celular).toBe("+573001110000");
    const cita = await db().selectFrom("cita").selectAll().executeTakeFirstOrThrow();
    expect(cita).toMatchObject({ paciente_id: e.existenteId, revision: "documento_con_otro_celular" });
    expect(await contarPendientesDeRevisar(db())).toEqual({ webNuevas: 0, enRevision: 1 });
  });

  it("con otro celular, el consentimiento NO se asocia a la ficha: queda en la cita con los datos de quien lo aceptó", async () => {
    const e = await escenario();
    await reservar(e.servicioId, { numeroDocumento: "52000111", celular: "3009998877", nombre: "Quien Reservó" });
    const cita = await db().selectFrom("cita").select("id").executeTakeFirstOrThrow();
    const consentimiento = await db().selectFrom("consentimiento").selectAll().executeTakeFirstOrThrow();
    expect(consentimiento).toMatchObject({
      paciente_id: null,
      cita_id: cita.id,
      aceptante_nombre: "Quien Reservó",
      aceptante_documento: "CC 52000111",
      aceptante_celular: "+573009998877",
    });
    const deLaFicha = await db().selectFrom("consentimiento").select("id").where("paciente_id", "=", e.existenteId).execute();
    expect(deLaFicha).toHaveLength(0);
  });

  it("al resolver la revisión vinculando, el consentimiento pasa a la ficha (una sola vez) y queda evento", async () => {
    const e = await escenario();
    await reservar(e.servicioId, { numeroDocumento: "52000111", celular: "3009998877" });
    const cita = await db().selectFrom("cita").select("id").executeTakeFirstOrThrow();
    const fabio = { actor: { tipo: "usuario" as const, id: "fabio" } };

    expect(await resolverRevisionVinculando(db(), cita.id, fabio)).toEqual({ consentimientosVinculados: 1 });
    const consentimiento = await db().selectFrom("consentimiento").selectAll().executeTakeFirstOrThrow();
    expect(consentimiento.paciente_id).toBe(e.existenteId);
    const fila = await db().selectFrom("cita").select(["revision", "revision_resuelta_en", "revision_resuelta_por"]).executeTakeFirstOrThrow();
    expect(fila).toMatchObject({ revision: "documento_con_otro_celular", revision_resuelta_por: "fabio" });
    expect(fila.revision_resuelta_en).not.toBeNull();
    const eventos = await db().selectFrom("cita_evento").select("tipo").where("cita_id", "=", cita.id).execute();
    expect(eventos.map((x) => x.tipo)).toContain("revision_resuelta");
    // La ficha no cambia: conserva su celular.
    const ficha = await db().selectFrom("paciente").select("celular").where("id", "=", e.existenteId).executeTakeFirstOrThrow();
    expect(ficha.celular).toBe("+573001110000");
    // No se resuelve dos veces.
    await expect(resolverRevisionVinculando(db(), cita.id, fabio)).rejects.toBeInstanceOf(RevisionNoPendiente);
  });

  it("el consentimiento solo admite vincularse una vez: no se edita, no se re-vincula, no se borra", async () => {
    const e = await escenario();
    await reservar(e.servicioId, { numeroDocumento: "52000111", celular: "3009998877" });
    const { id } = await db().selectFrom("consentimiento").select("id").executeTakeFirstOrThrow();
    await expect(db().updateTable("consentimiento").set({ texto: "otro" }).where("id", "=", id).execute()).rejects.toThrow(/solo inserción/);
    await expect(
      db().updateTable("consentimiento").set({ paciente_id: e.existenteId, aceptante_nombre: "Cambiado" }).where("id", "=", id).execute(),
    ).rejects.toThrow(/solo inserción/);
    await db().updateTable("consentimiento").set({ paciente_id: e.existenteId }).where("id", "=", id).execute();
    const otro = await db().insertInto("paciente").values({ tipo_documento: "CC", numero_documento: "99887766", nombre: "Otro" }).returning("id").executeTakeFirstOrThrow();
    await expect(db().updateTable("consentimiento").set({ paciente_id: otro.id }).where("id", "=", id).execute()).rejects.toThrow(/solo inserción/);
    await expect(db().deleteFrom("consentimiento").where("id", "=", id).execute()).rejects.toThrow(/solo inserción/);
  });

  it("las demás reservas guardan el consentimiento en la ficha y también quién lo aceptó", async () => {
    const { servicioId } = await escenario();
    await reservar(servicioId);
    const consentimiento = await db().selectFrom("consentimiento").selectAll().executeTakeFirstOrThrow();
    expect(consentimiento.paciente_id).not.toBeNull();
    expect(consentimiento).toMatchObject({ aceptante_nombre: "Persona Nueva", aceptante_celular: "+573002223344" });
  });

  it("varios pacientes pueden reservar con el mismo celular (el límite es por documento)", async () => {
    const e = await escenario();
    const madre = await reservar(e.servicioId, { numeroDocumento: "40111222", celular: "3004440000" });
    const hijo = await reservar(
      e.servicioId,
      { tipoDocumento: "TI", numeroDocumento: "1012345678", nombre: "Hijo", celular: "3004440000", inicio: h("10:00") },
      ctx({ ip: "203.0.113.12" }),
    );
    expect([madre.resultado.tipo, hijo.resultado.tipo]).toEqual(["creada", "creada"]);
    expect(await db().selectFrom("paciente").select("id").where("celular", "=", "+573004440000").execute()).toHaveLength(2);
  });
});

describe("límite de valoraciones futuras por documento (DPF)", () => {
  it("con el mismo celular informa el motivo; con otro celular responde de forma genérica; no crea nada", async () => {
    const e = await escenario();
    await crearCita(
      db(),
      { pacienteId: e.existenteId, servicioId: e.servicioId, inicio: h("11:00"), estado: "confirmada", origen: "panel" },
      { modo: "panel", actor: { tipo: "usuario", id: "fabio" } },
    );
    const mismo = await reservar(e.servicioId, { numeroDocumento: "52000111", celular: "3001110000" });
    expect(mismo.resultado).toEqual({ tipo: "limite_valoraciones", especifico: true });
    const otro = await reservar(e.servicioId, { numeroDocumento: "52000111", celular: "3007776655" }, ctx({ ip: "203.0.113.13" }));
    expect(otro.resultado).toEqual({ tipo: "limite_valoraciones", especifico: false });
    expect(await db().selectFrom("cita").select("id").execute()).toHaveLength(1);
  });
});

describe("código de verificación", () => {
  it("no se guarda en claro", async () => {
    const e = await escenario();
    const { emisor, codigos } = emisorFalso();
    await iniciarReserva(db(), datos(e.servicioId), entorno(emisor), ctx());
    const codigo = [...codigos.values()][0]!;
    const fila = await db().selectFrom("verificacion_celular").selectAll().executeTakeFirstOrThrow();
    expect(JSON.stringify(fila)).not.toContain(codigo);
    expect(fila.codigo_hmac).toMatch(/^[0-9a-f]{64}$/);
  });

  it("cuenta intentos fallidos y bloquea al quinto, incluso si después llega el código correcto", async () => {
    const e = await escenario();
    const { emisor, codigos } = emisorFalso();
    const inicio = await iniciarReserva(db(), datos(e.servicioId), entorno(emisor), ctx());
    if (!inicio.ok) throw new Error();
    const correcto = [...codigos.values()][0]!;
    const malo = correcto === "000000" ? "111111" : "000000";
    const resultados = [];
    for (let i = 0; i < LIMITES.intentosPorCodigo; i++) resultados.push(await verificarCodigo(db(), inicio.token, malo, ctx()));
    expect(resultados.slice(0, 4).map((r) => (r.tipo === "codigo_invalido" ? r.intentosRestantes : r.tipo))).toEqual([4, 3, 2, 1]);
    expect(resultados[4]).toEqual({ tipo: "limite" });
    expect(await verificarCodigo(db(), inicio.token, correcto, ctx())).toEqual({ tipo: "limite" });
    expect(await db().selectFrom("cita").select("id").execute()).toHaveLength(0);
  });

  it("vence a los 10 minutos", async () => {
    const e = await escenario();
    const { emisor, codigos } = emisorFalso();
    const inicio = await iniciarReserva(db(), datos(e.servicioId), entorno(emisor), ctx());
    if (!inicio.ok) throw new Error();
    const tarde = ctx({ ahora: new Date(AHORA.getTime() + (LIMITES.minutosVigenciaCodigo + 1) * 60_000) });
    expect(await verificarCodigo(db(), inicio.token, [...codigos.values()][0]!, tarde)).toEqual({ tipo: "codigo_vencido" });
  });

  it("reenviar exige esperar y anula el código anterior", async () => {
    const e = await escenario();
    const { emisor, codigos } = emisorFalso();
    const inicio = await iniciarReserva(db(), datos(e.servicioId), entorno(emisor), ctx());
    if (!inicio.ok) throw new Error();
    const primero = [...codigos.values()][0]!;
    expect(await reenviarCodigo(db(), inicio.token, emisor, ctx())).toEqual({ ok: false, motivo: "espera" });
    const despues = ctx({ ahora: new Date(AHORA.getTime() + 61_000) });
    expect(await reenviarCodigo(db(), inicio.token, emisor, despues)).toEqual({ ok: true });
    const segundo = [...codigos.values()][0]!;
    if (primero !== segundo) {
      expect((await verificarCodigo(db(), inicio.token, primero, despues)).tipo).toBe("codigo_invalido");
    }
    expect((await verificarCodigo(db(), inicio.token, segundo, despues)).tipo).toBe("creada");
  });

  it("un token inventado no sirve", async () => {
    await escenario();
    expect(await verificarCodigo(db(), "token-falso", "123456", ctx())).toEqual({ tipo: "no_valida" });
    expect(await completarReserva(db(), "token-falso", ctx())).toEqual({ tipo: "no_valida" });
  });
});

describe("límites de solicitudes", () => {
  it("máximo de códigos por celular por hora", async () => {
    const e = await escenario();
    const { emisor } = emisorFalso();
    const resultados = [];
    for (let i = 0; i < LIMITES.codigosPorCelularPorHora + 1; i++) {
      resultados.push(await iniciarReserva(db(), datos(e.servicioId), entorno(emisor), ctx({ ip: `198.51.100.${i}` })));
    }
    expect(resultados.slice(0, -1).every((r) => r.ok)).toBe(true);
    expect(resultados.at(-1)).toEqual({ ok: false, motivo: "limite" });
  });

  it("máximo de códigos por IP por hora, y queda en auditoría", async () => {
    const e = await escenario();
    const { emisor } = emisorFalso();
    const resultados = [];
    for (let i = 0; i < LIMITES.codigosPorIpPorHora + 1; i++) {
      resultados.push(await iniciarReserva(db(), datos(e.servicioId, { celular: `300100${String(i).padStart(4, "0")}` }), entorno(emisor), ctx()));
    }
    expect(resultados.at(-1)).toEqual({ ok: false, motivo: "limite" });
    const auditoria = await db().selectFrom("auditoria").select(["accion", "ip"]).execute();
    expect(auditoria).toContainEqual({ accion: "reserva.limite_codigos", ip: "203.0.113.10" });
  });

  it("máximo de verificaciones por IP por hora", async () => {
    const e = await escenario();
    await db()
      .insertInto("intento_verificacion")
      .values(Array.from({ length: LIMITES.verificacionesPorIpPorHora }, () => ({ ip: "203.0.113.10", exitoso: false, creado_en: AHORA })))
      .execute();
    const { emisor, codigos } = emisorFalso();
    const inicio = await iniciarReserva(db(), datos(e.servicioId), entorno(emisor), ctx({ ip: "198.51.100.200" }));
    if (!inicio.ok) throw new Error();
    expect(await verificarCodigo(db(), inicio.token, [...codigos.values()][0]!, ctx())).toEqual({ tipo: "limite" });
  });
});

describe("cupo ocupado mientras la persona llenaba el formulario", () => {
  it("avisa, conserva la verificación y permite elegir otro horario sin pedir otro código", async () => {
    const e = await escenario();
    const { emisor, codigos } = emisorFalso();
    const inicio = await iniciarReserva(db(), datos(e.servicioId), entorno(emisor), ctx());
    if (!inicio.ok) throw new Error();
    // Otra persona toma el cupo antes de que esta escriba el código.
    await crearCita(
      db(),
      { pacienteId: e.existenteId, servicioId: e.servicioId, inicio: h("09:00"), estado: "confirmada", origen: "panel" },
      { modo: "panel", actor: { tipo: "usuario", id: "fabio" } },
    );
    const r = await verificarCodigo(db(), inicio.token, [...codigos.values()][0]!, ctx());
    expect(r).toEqual({ tipo: "cupo_ocupado", fecha: LUNES });
    // No quedó ficha creada a medias.
    expect(await db().selectFrom("paciente").select("id").execute()).toHaveLength(1);

    expect(await completarReserva(db(), inicio.token, ctx(), h("10:00"))).toMatchObject({ tipo: "creada" });
    expect(await db().selectFrom("paciente").select("id").execute()).toHaveLength(2);
  });

  it("la ventana para completar tras verificar es limitada", async () => {
    const e = await escenario();
    const { emisor, codigos } = emisorFalso();
    const inicio = await iniciarReserva(db(), datos(e.servicioId), entorno(emisor), ctx());
    if (!inicio.ok) throw new Error();
    await crearCita(
      db(),
      { pacienteId: e.existenteId, servicioId: e.servicioId, inicio: h("09:00"), estado: "confirmada", origen: "panel" },
      { modo: "panel", actor: { tipo: "usuario", id: "fabio" } },
    );
    await verificarCodigo(db(), inicio.token, [...codigos.values()][0]!, ctx());
    const tarde = ctx({ ahora: new Date(AHORA.getTime() + (LIMITES.minutosParaCompletarTrasVerificar + 1) * 60_000) });
    expect(await completarReserva(db(), inicio.token, tarde, h("10:00"))).toEqual({ tipo: "no_valida" });
  });
});

describe("validaciones de entrada", () => {
  it("rechaza campos inválidos sin crear solicitud ni enviar código", async () => {
    const e = await escenario();
    const { emisor, enviados } = emisorFalso();
    const r = await iniciarReserva(
      db(),
      datos(e.servicioId, { numeroDocumento: "12", celular: "604 123 4567", correo: "x@", aceptaAutorizacion: false, nombre: "A" }),
      entorno(emisor),
      ctx(),
    );
    expect(r).toMatchObject({ ok: false, motivo: "campos" });
    if (!r.ok && r.motivo === "campos") expect(Object.keys(r.errores).sort()).toEqual(["autorizacion", "celular", "correo", "documento", "nombre"]);
    expect(enviados).toHaveLength(0);
  });

  it("rechaza horarios que no son cupos y servicios que no son públicos", async () => {
    const e = await escenario();
    const { emisor } = emisorFalso();
    expect(await iniciarReserva(db(), datos(e.servicioId, { inicio: h("12:30") }), entorno(emisor), ctx())).toEqual({
      ok: false,
      motivo: "cupo_no_disponible",
    });
    const privado = await db()
      .insertInto("servicio")
      .values({ slug: "privado", nombre: "Privado", duracion_min: 30, politica_reserva: "solo_admin" })
      .returning("id")
      .executeTakeFirstOrThrow();
    expect(await iniciarReserva(db(), datos(privado.id), entorno(emisor), ctx())).toEqual({ ok: false, motivo: "no_disponible" });
  });

  it("si el texto de autorización cambia entre pasos, exige aceptarlo de nuevo", async () => {
    const e = await escenario();
    const { emisor, codigos } = emisorFalso();
    const inicio = await iniciarReserva(db(), datos(e.servicioId), entorno(emisor), ctx());
    if (!inicio.ok) throw new Error();
    // Versión nueva (la tabla es de solo inserción): la vigente cambia.
    await db().insertInto("texto_autorizacion").values({ ...TEXTO, version: "v2", texto: `${TEXTO.texto} Cambio.` }).execute();
    expect(await verificarCodigo(db(), inicio.token, [...codigos.values()][0]!, ctx())).toEqual({ tipo: "autorizacion_cambio" });
  });

  it("sin documento obligatorio (DPF), la reserva sin documento crea una ficha marcada para revisión", async () => {
    const e = await escenario();
    await db().updateTable("configuracion").set({ valor: "false" }).where("clave", "=", "reserva_documento_obligatorio").execute();
    const { resultado } = await reservar(e.servicioId, { tipoDocumento: "", numeroDocumento: "" });
    expect(resultado.tipo).toBe("creada");
    expect((await db().selectFrom("cita").select("revision").executeTakeFirstOrThrow()).revision).toBe("sin_documento");
  });
});

describe("estado de la reserva pública", () => {
  it("se desactiva sin emisor, sin texto legal o con texto de demostración en producción", async () => {
    await escenario();
    const { emisor } = emisorFalso();
    expect(await estadoReservaPublica(db(), entorno(null))).toEqual({ disponible: false, motivo: "sin_emisor" });
    await db().insertInto("texto_autorizacion").values({ ...TEXTO, version: "demo-2", demostracion: true }).execute();
    expect(await estadoReservaPublica(db(), { emisor, produccion: true })).toEqual({ disponible: false, motivo: "sin_texto_legal" });
    expect((await estadoReservaPublica(db(), { emisor, produccion: false })).disponible).toBe(true);
    // Un borrador real tampoco habilita la reserva en producción; la versión aprobada sí.
    await db().insertInto("texto_autorizacion").values({ ...TEXTO, version: "borrador-2026-10-08" }).execute();
    expect(await estadoReservaPublica(db(), { emisor, produccion: true })).toEqual({ disponible: false, motivo: "sin_texto_legal" });
    await db().insertInto("texto_autorizacion").values({ ...TEXTO, version: "2026-10-09" }).execute();
    expect((await estadoReservaPublica(db(), { emisor, produccion: true })).disponible).toBe(true);
    await sql`TRUNCATE texto_autorizacion`.execute(db());
    expect(await estadoReservaPublica(db(), { emisor, produccion: false })).toEqual({ disponible: false, motivo: "sin_texto_legal" });
  });

  it("el emisor de desarrollo no existe ni funciona en producción", async () => {
    expect(obtenerEmisor({ APP_ENV: "production" })).toBeNull();
    expect(obtenerEmisor({ RAILWAY_ENVIRONMENT_NAME: "production" })).toBeNull();
    expect(obtenerEmisor({ APP_ENV: "development" })).toBe(emisorDesarrollo);
    vi.stubEnv("APP_ENV", "production");
    try {
      await expect(emisorDesarrollo.enviar("+573001112233", "123456")).rejects.toBeInstanceOf(EmisorNoPermitido);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("lo que ve el público", () => {
  it("los cupos son solo instantes de inicio; nada de motivos ni de otras citas", async () => {
    const e = await escenario();
    await db()
      .insertInto("bloqueo")
      .values({ inicio: h("10:00"), fin: h("11:00"), motivo: "Odontólogo en cirugía de su mamá" })
      .execute();
    await crearCita(
      db(),
      { pacienteId: e.existenteId, servicioId: e.servicioId, inicio: h("08:00"), estado: "confirmada", origen: "panel" },
      { modo: "panel", actor: { tipo: "usuario", id: "fabio" } },
    );
    const cupos = await cuposPublicos(db(), { duracionMin: 30 }, AHORA, { desde: LUNES, hasta: LUNES });
    const serializado = JSON.stringify(cupos);
    expect(cupos.every((c) => c instanceof Date)).toBe(true);
    expect(serializado).not.toMatch(/cirug|Existente|52000111/);
    expect(cupos.map((c) => c.toISOString())).not.toContain(h("10:00").toISOString());
    expect(cupos.map((c) => c.toISOString())).not.toContain(h("08:00").toISOString());
  });
});
