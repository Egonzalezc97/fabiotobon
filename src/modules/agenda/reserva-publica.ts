import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { BaseDeDatos } from "@/lib/db";
import { normalizarCelular } from "@/lib/telefono";
import { codigoCoincide, generarCodigo, hmacCodigo, type EmisorCodigo } from "@/lib/verificacion";
import { registrar } from "@/modules/auditoria";
import { leerParametros, leerTextoAutorizacion, type TextoAutorizacion } from "@/modules/configuracion";
import { normalizarDocumento, type Documento } from "@/modules/pacientes/documento";
import { crearCita, ESTADOS_ACTIVOS, ocupadosEnRango } from "./citas";
import { calcularCupos, ultimoDiaReservable } from "./disponibilidad";
import { CupoNoDisponible } from "./errores";
import { leerHorarioMinutos } from "./horario";
import { fechaLocal, instante, sumarDias, type FechaLocal } from "./tiempo";

// Reserva pública de la valoración (pacientes nuevos y, sin revelarlo, existentes).
// Regla de oro: ANTES de verificar el código la respuesta es idéntica exista o no el documento;
// el documento ni siquiera se consulta hasta que el celular está verificado.

/** Límites de seguridad (no son reglas de negocio de Fabio). */
export const LIMITES = {
  codigosPorIpPorHora: 5,
  codigosPorCelularPorHora: 3,
  codigosPorCelularPorDia: 6,
  intentosPorCodigo: 5,
  verificacionesPorIpPorHora: 20,
  segundosEntreReenvios: 60,
  minutosVigenciaCodigo: 10,
  minutosParaCompletarTrasVerificar: 15,
  minutosVigenciaSolicitud: 45,
} as const;

export type Contexto = { ip: string | null; userAgent: string | null; ahora: Date; secreto: string };

const sha256 = (texto: string) => createHash("sha256").update(texto).digest("hex");
const minutos = (n: number) => n * 60_000;

// ---------------------------------------------------------------------------
// Disponibilidad pública
// ---------------------------------------------------------------------------

export type ServicioReservable = { id: string; slug: string; nombre: string; duracionMin: number; precioCop: number | null };

export async function serviciosReservables(db: BaseDeDatos): Promise<ServicioReservable[]> {
  const filas = await db
    .selectFrom("servicio")
    .select(["id", "slug", "nombre", "duracion_min", "precio_cop", "mostrar_precio"])
    .where("activo", "=", true)
    .where("politica_reserva", "=", "publico")
    .orderBy("orden")
    .execute();
  return filas.map((f) => ({
    id: f.id,
    slug: f.slug,
    nombre: f.nombre,
    duracionMin: f.duracion_min,
    precioCop: f.mostrar_precio ? f.precio_cop : null,
  }));
}

/** Cupos públicos: solo instantes de inicio. Nada de motivos, pacientes ni otras citas. */
export async function cuposPublicos(
  db: BaseDeDatos,
  servicio: { duracionMin: number },
  ahora: Date,
  rango?: { desde: FechaLocal; hasta: FechaLocal },
): Promise<Date[]> {
  const parametros = await leerParametros(db);
  const desde = rango?.desde ?? fechaLocal(ahora);
  const hasta = rango?.hasta ?? ultimoDiaReservable(ahora, parametros.horizonteDias);
  const [horario, ocupados] = await Promise.all([
    leerHorarioMinutos(db),
    ocupadosEnRango(db, { inicio: instante(desde), fin: instante(sumarDias(hasta, 1)) }),
  ]);
  return calcularCupos({ desde, hasta, ahora, horario, ocupados, duracionMin: servicio.duracionMin, parametros });
}

// ---------------------------------------------------------------------------
// Estado de la reserva pública
// ---------------------------------------------------------------------------

export type EstadoReservaPublica =
  | { disponible: true; texto: TextoAutorizacion; documentoObligatorio: boolean }
  | { disponible: false; motivo: "sin_emisor" | "sin_texto_legal" | "sin_servicio" };

/** En producción, sin emisor real o sin texto legal real, la reserva pública queda desactivada. */
export async function estadoReservaPublica(
  db: BaseDeDatos,
  entorno: { emisor: EmisorCodigo | null; produccion: boolean },
): Promise<EstadoReservaPublica> {
  if (!entorno.emisor) return { disponible: false, motivo: "sin_emisor" };
  const texto = await leerTextoAutorizacion(db);
  if (!texto || (entorno.produccion && texto.demostracion)) return { disponible: false, motivo: "sin_texto_legal" };
  if ((await serviciosReservables(db)).length === 0) return { disponible: false, motivo: "sin_servicio" };
  const { documentoObligatorio } = await leerParametros(db);
  return { disponible: true, texto, documentoObligatorio };
}

// ---------------------------------------------------------------------------
// Paso 2: datos → solicitud + código
// ---------------------------------------------------------------------------

export type DatosReserva = {
  servicioId: string;
  inicio: Date;
  tipoDocumento?: string;
  numeroDocumento?: string;
  nombre: string;
  celular: string;
  correo?: string;
  aceptaAutorizacion: boolean;
  versionAutorizacion: string;
};

export type ErroresCampos = Partial<Record<"documento" | "nombre" | "celular" | "correo" | "autorizacion", string>>;

export type ResultadoInicio =
  | { ok: true; token: string }
  | { ok: false; motivo: "campos"; errores: ErroresCampos }
  | { ok: false; motivo: "cupo_no_disponible" | "limite" | "no_disponible" | "autorizacion_cambio" };

async function contar(consulta: Promise<{ n: string } | undefined>) {
  return Number((await consulta)?.n ?? 0);
}

async function superaLimitesDeCodigo(db: BaseDeDatos, celular: string, ip: string | null, ahora: Date) {
  const haceUnaHora = new Date(ahora.getTime() - minutos(60));
  const haceUnDia = new Date(ahora.getTime() - minutos(60 * 24));
  const base = db.selectFrom("verificacion_celular").select((eb) => eb.fn.countAll<string>().as("n"));
  const [porIp, porCelularHora, porCelularDia] = await Promise.all([
    ip ? contar(base.where("ip", "=", ip).where("creada_en", ">", haceUnaHora).executeTakeFirst()) : Promise.resolve(0),
    contar(base.where("celular", "=", celular).where("creada_en", ">", haceUnaHora).executeTakeFirst()),
    contar(base.where("celular", "=", celular).where("creada_en", ">", haceUnDia).executeTakeFirst()),
  ]);
  return (
    porIp >= LIMITES.codigosPorIpPorHora ||
    porCelularHora >= LIMITES.codigosPorCelularPorHora ||
    porCelularDia >= LIMITES.codigosPorCelularPorDia
  );
}

async function emitirCodigo(
  db: BaseDeDatos,
  solicitud: { id: string; celular: string },
  emisor: EmisorCodigo,
  ctx: Contexto,
) {
  const codigo = generarCodigo();
  // Un código nuevo anula los anteriores de la misma solicitud.
  await db
    .updateTable("verificacion_celular")
    .set({ expira_en: ctx.ahora })
    .where("solicitud_id", "=", solicitud.id)
    .where("consumida_en", "is", null)
    .execute();
  const id = randomUUID();
  await db
    .insertInto("verificacion_celular")
    .values({
      id,
      solicitud_id: solicitud.id,
      celular: solicitud.celular,
      codigo_hmac: hmacCodigo(ctx.secreto, id, codigo),
      expira_en: new Date(ctx.ahora.getTime() + minutos(LIMITES.minutosVigenciaCodigo)),
      ip: ctx.ip,
      creada_en: ctx.ahora,
    })
    .execute();
  await emisor.enviar(solicitud.celular, codigo);
}

/** Purga datos personales de reservas abandonadas o terminadas. */
async function purgar(db: BaseDeDatos, ahora: Date) {
  await db.deleteFrom("solicitud_reserva").where("creada_en", "<", new Date(ahora.getTime() - minutos(60 * 24))).execute();
  await db.deleteFrom("verificacion_celular").where("creada_en", "<", new Date(ahora.getTime() - minutos(60 * 48))).execute();
  await db.deleteFrom("intento_verificacion").where("creado_en", "<", new Date(ahora.getTime() - minutos(60 * 48))).execute();
}

export async function iniciarReserva(
  db: BaseDeDatos,
  datos: DatosReserva,
  entorno: { emisor: EmisorCodigo | null; produccion: boolean },
  ctx: Contexto,
): Promise<ResultadoInicio> {
  const estado = await estadoReservaPublica(db, entorno);
  if (!estado.disponible || !entorno.emisor) return { ok: false, motivo: "no_disponible" };
  if (datos.versionAutorizacion !== estado.texto.version) return { ok: false, motivo: "autorizacion_cambio" };

  // Validación de campos: solo formato. El documento NO se busca en la base en este paso.
  const errores: ErroresCampos = {};
  let documento: Documento | null = null;
  const escribioDocumento = Boolean(datos.numeroDocumento?.trim());
  if (estado.documentoObligatorio || escribioDocumento) {
    documento = normalizarDocumento(datos.tipoDocumento, datos.numeroDocumento);
    if (!documento) errores.documento = "Revisa el tipo y el número de documento.";
  }
  const nombre = datos.nombre.trim().replace(/\s+/g, " ");
  if (nombre.length < 2 || nombre.length > 200) errores.nombre = "Escribe tu nombre completo.";
  const celular = normalizarCelular(datos.celular);
  if (!celular) errores.celular = "Escribe un número de celular válido.";
  const correo = datos.correo?.trim() || null;
  if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) errores.correo = "Revisa el correo.";
  if (!datos.aceptaAutorizacion) errores.autorizacion = "Para reservar debes aceptar la autorización.";
  if (Object.keys(errores).length > 0 || !celular) return { ok: false, motivo: "campos", errores };

  const servicio = (await serviciosReservables(db)).find((s) => s.id === datos.servicioId);
  if (!servicio) return { ok: false, motivo: "no_disponible" };
  const fecha = fechaLocal(datos.inicio);
  const cupos = await cuposPublicos(db, servicio, ctx.ahora, { desde: fecha, hasta: fecha });
  if (!cupos.some((c) => c.getTime() === datos.inicio.getTime())) return { ok: false, motivo: "cupo_no_disponible" };

  if (await superaLimitesDeCodigo(db, celular, ctx.ip, ctx.ahora)) {
    await registrar(db, { actorTipo: "anonimo", accion: "reserva.limite_codigos", ip: ctx.ip, userAgent: ctx.userAgent });
    return { ok: false, motivo: "limite" };
  }

  await purgar(db, ctx.ahora);
  const token = randomBytes(32).toString("base64url");
  const solicitud = await db
    .insertInto("solicitud_reserva")
    .values({
      token_sha256: sha256(token),
      servicio_id: servicio.id,
      inicio: datos.inicio,
      tipo_documento: documento?.tipo ?? null,
      numero_documento: documento?.numero ?? null,
      nombre,
      celular,
      correo,
      consentimiento_version: estado.texto.version,
      consentimiento_sha256: sha256(estado.texto.texto),
      ip: ctx.ip,
      user_agent: ctx.userAgent?.slice(0, 500) ?? null,
      creada_en: ctx.ahora,
      expira_en: new Date(ctx.ahora.getTime() + minutos(LIMITES.minutosVigenciaSolicitud)),
    })
    .returning(["id", "celular"])
    .executeTakeFirstOrThrow();
  await emitirCodigo(db, solicitud, entorno.emisor, ctx);
  return { ok: true, token };
}

// ---------------------------------------------------------------------------
// Solicitud en curso
// ---------------------------------------------------------------------------

export async function obtenerSolicitud(db: BaseDeDatos, token: string | undefined, ahora: Date) {
  if (!token || token.length > 100) return null;
  const s = await db
    .selectFrom("solicitud_reserva")
    .innerJoin("servicio", "servicio.id", "solicitud_reserva.servicio_id")
    .select([
      "solicitud_reserva.id",
      "solicitud_reserva.estado",
      "solicitud_reserva.inicio",
      "solicitud_reserva.celular",
      "solicitud_reserva.verificada_en",
      "solicitud_reserva.expira_en",
      "solicitud_reserva.cita_id",
      "solicitud_reserva.servicio_id",
      "servicio.nombre as servicioNombre",
      "servicio.duracion_min as servicioDuracionMin",
    ])
    .where("token_sha256", "=", sha256(token))
    .executeTakeFirst();
  if (!s) return null;
  // Una reserva completada se puede volver a mostrar mientras la solicitud exista (24 h).
  if (s.estado !== "completada" && s.expira_en < ahora) return null;
  return s;
}

export type ResultadoReenvio = { ok: true } | { ok: false; motivo: "espera" | "limite" | "no_valida" };

export async function reenviarCodigo(
  db: BaseDeDatos,
  token: string | undefined,
  emisor: EmisorCodigo | null,
  ctx: Contexto,
): Promise<ResultadoReenvio> {
  const solicitud = await obtenerSolicitud(db, token, ctx.ahora);
  if (!solicitud || solicitud.estado !== "pendiente_codigo" || !emisor) return { ok: false, motivo: "no_valida" };
  const ultima = await db
    .selectFrom("verificacion_celular")
    .select("creada_en")
    .where("solicitud_id", "=", solicitud.id)
    .orderBy("creada_en", "desc")
    .executeTakeFirst();
  if (ultima && ctx.ahora.getTime() - ultima.creada_en.getTime() < LIMITES.segundosEntreReenvios * 1000) {
    return { ok: false, motivo: "espera" };
  }
  if (await superaLimitesDeCodigo(db, solicitud.celular, ctx.ip, ctx.ahora)) {
    await registrar(db, { actorTipo: "anonimo", accion: "reserva.limite_codigos", ip: ctx.ip, userAgent: ctx.userAgent });
    return { ok: false, motivo: "limite" };
  }
  await emitirCodigo(db, solicitud, emisor, ctx);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Paso 3: código → verificada → cita
// ---------------------------------------------------------------------------

export type ResultadoReserva =
  | { tipo: "creada"; citaId: string }
  | { tipo: "codigo_invalido"; intentosRestantes: number }
  | { tipo: "codigo_vencido" }
  | { tipo: "limite" }
  | { tipo: "no_valida" }
  | { tipo: "cupo_ocupado"; fecha: FechaLocal }
  /** El mismo documento ya tiene valoraciones futuras. `especifico` solo si el celular coincide con la ficha. */
  | { tipo: "limite_valoraciones"; especifico: boolean }
  | { tipo: "autorizacion_cambio" };

export async function verificarCodigo(
  db: BaseDeDatos,
  token: string | undefined,
  codigo: string,
  ctx: Contexto,
): Promise<ResultadoReserva> {
  const haceUnaHora = new Date(ctx.ahora.getTime() - minutos(60));
  if (ctx.ip) {
    const intentos = Number(
      (
        await db
          .selectFrom("intento_verificacion")
          .select((eb) => eb.fn.countAll<string>().as("n"))
          .where("ip", "=", ctx.ip)
          .where("creado_en", ">", haceUnaHora)
          .executeTakeFirst()
      )?.n ?? 0,
    );
    if (intentos >= LIMITES.verificacionesPorIpPorHora) {
      await registrar(db, { actorTipo: "anonimo", accion: "reserva.limite_verificacion", ip: ctx.ip, userAgent: ctx.userAgent });
      return { tipo: "limite" };
    }
  }

  const solicitud = await obtenerSolicitud(db, token, ctx.ahora);
  if (!solicitud || solicitud.estado !== "pendiente_codigo") return { tipo: "no_valida" };

  const resultado = await db.transaction().execute(async (trx) => {
    const verificacion = await trx
      .selectFrom("verificacion_celular")
      .select(["id", "codigo_hmac", "intentos", "expira_en", "consumida_en"])
      .where("solicitud_id", "=", solicitud.id)
      .orderBy("creada_en", "desc")
      .forUpdate()
      .executeTakeFirst();
    if (!verificacion || verificacion.consumida_en) return { tipo: "no_valida" } as const;
    if (verificacion.expira_en <= ctx.ahora) return { tipo: "codigo_vencido" } as const;
    if (verificacion.intentos >= LIMITES.intentosPorCodigo) return { tipo: "limite" } as const;

    const correcto = codigoCoincide(ctx.secreto, verificacion.id, codigo.replace(/\s/g, ""), verificacion.codigo_hmac);
    await trx.insertInto("intento_verificacion").values({ ip: ctx.ip, exitoso: correcto, creado_en: ctx.ahora }).execute();
    if (!correcto) {
      const intentos = verificacion.intentos + 1;
      await trx.updateTable("verificacion_celular").set({ intentos }).where("id", "=", verificacion.id).execute();
      return intentos >= LIMITES.intentosPorCodigo
        ? ({ tipo: "limite" } as const)
        : ({ tipo: "codigo_invalido", intentosRestantes: LIMITES.intentosPorCodigo - intentos } as const);
    }
    await trx.updateTable("verificacion_celular").set({ consumida_en: ctx.ahora }).where("id", "=", verificacion.id).execute();
    await trx
      .updateTable("solicitud_reserva")
      .set({ estado: "verificada", verificada_en: ctx.ahora })
      .where("id", "=", solicitud.id)
      .execute();
    return { tipo: "verificada" } as const;
  });

  if (resultado.tipo !== "verificada") return resultado;
  return completarReserva(db, token, ctx);
}

class Abortar extends Error {
  constructor(readonly resultado: ResultadoReserva) {
    super(resultado.tipo);
  }
}

/**
 * Crea la cita de una solicitud verificada. Si `nuevoInicio` viene, cambia el horario elegido
 * (cuando el original se ocupó). Todo en una transacción: si algo falla, no queda ficha ni cita a medias.
 */
export async function completarReserva(
  db: BaseDeDatos,
  token: string | undefined,
  ctx: Contexto,
  nuevoInicio?: Date,
): Promise<ResultadoReserva> {
  try {
    return await db.transaction().execute(async (trx) => {
      const s = await trx
        .selectFrom("solicitud_reserva")
        .selectAll()
        .where("token_sha256", "=", sha256(token ?? ""))
        .forUpdate()
        .executeTakeFirst();
      const vigente =
        s?.estado === "verificada" &&
        s.verificada_en !== null &&
        ctx.ahora.getTime() - s.verificada_en.getTime() <= minutos(LIMITES.minutosParaCompletarTrasVerificar);
      if (!s || !vigente) throw new Abortar({ tipo: "no_valida" });

      const inicio = nuevoInicio ?? s.inicio;
      const [parametros, texto] = await Promise.all([leerParametros(trx), leerTextoAutorizacion(trx)]);
      if (!texto || texto.version !== s.consentimiento_version || sha256(texto.texto) !== s.consentimiento_sha256) {
        throw new Abortar({ tipo: "autorizacion_cambio" });
      }

      // Identidad: solo ahora, con el celular verificado, se consulta el documento.
      const datosIngresados = {
        nombre: s.nombre,
        celular: s.celular,
        correo: s.correo,
        documento: s.tipo_documento ? `${s.tipo_documento} ${s.numero_documento}` : null,
      };
      let pacienteId: string;
      let revision: "documento_con_otro_celular" | "sin_documento" | null = null;
      let celularCoincide = true;
      let detalle: Record<string, unknown> = {};

      if (s.tipo_documento && s.numero_documento) {
        const existente = await trx
          .selectFrom("paciente")
          .select(["id", "celular"])
          .where("tipo_documento", "=", s.tipo_documento)
          .where("numero_documento", "=", s.numero_documento)
          .forUpdate()
          .executeTakeFirst();
        if (!existente) {
          pacienteId = (
            await trx
              .insertInto("paciente")
              .values({
                tipo_documento: s.tipo_documento,
                numero_documento: s.numero_documento,
                nombre: s.nombre,
                celular: s.celular,
                celular_verificado_en: s.verificada_en,
                correo: s.correo,
              })
              .returning("id")
              .executeTakeFirstOrThrow()
          ).id;
        } else {
          // La ficha existente NO se modifica. Lo escrito queda en el evento de la cita.
          pacienteId = existente.id;
          detalle = { datos_ingresados: datosIngresados };
          if (existente.celular !== s.celular) {
            celularCoincide = false;
            revision = "documento_con_otro_celular";
          }
        }
      } else {
        // DPF: si Fabio decide no pedir documento, cada reserva sin documento crea una ficha nueva para revisión.
        pacienteId = (
          await trx
            .insertInto("paciente")
            .values({ nombre: s.nombre, celular: s.celular, celular_verificado_en: s.verificada_en, correo: s.correo })
            .returning("id")
            .executeTakeFirstOrThrow()
        ).id;
        revision = "sin_documento";
      }

      // Límite de valoraciones futuras activas POR DOCUMENTO (es decir, por ficha).
      const futuras = Number(
        (
          await trx
            .selectFrom("cita")
            .innerJoin("servicio", "servicio.id", "cita.servicio_id")
            .select((eb) => eb.fn.countAll<string>().as("n"))
            .where("cita.paciente_id", "=", pacienteId)
            .where("cita.estado", "in", ESTADOS_ACTIVOS)
            .where("cita.inicio", ">", ctx.ahora)
            .where("servicio.politica_reserva", "=", "publico")
            .executeTakeFirst()
        )?.n ?? 0,
      );
      if (futuras >= parametros.maxValoracionesFuturas) {
        throw new Abortar({ tipo: "limite_valoraciones", especifico: celularCoincide });
      }

      let cita: { id: string };
      try {
        cita = await crearCita(
          trx,
          {
            pacienteId,
            servicioId: s.servicio_id,
            inicio,
            estado: parametros.estadoInicialCitaWeb,
            origen: "web",
            revision,
            detalleEvento: detalle,
          },
          { modo: "publico", ahora: ctx.ahora, actor: { tipo: "paciente", id: pacienteId } },
        );
      } catch (error) {
        if (error instanceof CupoNoDisponible) throw new Abortar({ tipo: "cupo_ocupado", fecha: fechaLocal(inicio) });
        throw error;
      }

      // Con documento existente y OTRO celular, quien acepta puede no ser el titular: el consentimiento queda
      // ligado solo a la cita (con los datos de quien lo aceptó) hasta que se resuelva la revisión.
      await trx
        .insertInto("consentimiento")
        .values({
          paciente_id: revision === "documento_con_otro_celular" ? null : pacienteId,
          cita_id: cita.id,
          aceptante_nombre: s.nombre,
          aceptante_documento: datosIngresados.documento,
          aceptante_celular: s.celular,
          tipo: "tratamiento_datos",
          version: texto.version,
          texto: texto.texto,
          texto_sha256: s.consentimiento_sha256,
          origen: "web",
          aceptado_en: s.creada_en,
          ip: s.ip,
          user_agent: s.user_agent,
        })
        .execute();
      await trx
        .updateTable("solicitud_reserva")
        .set({ estado: "completada", cita_id: cita.id, inicio })
        .where("id", "=", s.id)
        .execute();
      return { tipo: "creada", citaId: cita.id } as const;
    });
  } catch (error) {
    if (error instanceof Abortar) return error.resultado;
    throw error;
  }
}

/** Datos mínimos para la pantalla de confirmación (solo de la cita de esta solicitud). */
export async function resumenReservaCompletada(db: BaseDeDatos, token: string | undefined, ahora: Date) {
  const s = await obtenerSolicitud(db, token, ahora);
  if (!s || s.estado !== "completada" || !s.cita_id) return null;
  const cita = await db
    .selectFrom("cita")
    .innerJoin("servicio", "servicio.id", "cita.servicio_id")
    .select(["cita.inicio", "cita.fin", "cita.estado", "servicio.nombre as servicioNombre"])
    .where("cita.id", "=", s.cita_id)
    .executeTakeFirst();
  return cita ?? null;
}

