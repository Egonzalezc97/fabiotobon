import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirPanel } from "@/lib/auth/servidor";
import { db } from "@/lib/db";
import { formatearCelular } from "@/lib/telefono";
import { marcarCitaVista, NOMBRES_ESTADO, transicionesPermitidas, type EstadoCita } from "@/modules/agenda/citas";
import { obtenerDetalleCita } from "@/modules/agenda/consultas";
import { fechaLocal, formatearFechaLarga, horaLocal } from "@/modules/agenda/tiempo";
import { leerParametros } from "@/modules/configuracion";
import { formatearDocumento } from "@/modules/pacientes/documento";
import { Alerta, Etiqueta } from "@/components/panel/ui";
import { AccionesCita } from "./acciones-cita";
import { ResolverRevision } from "./resolver-revision";

export const metadata: Metadata = { title: "Cita" };

const ORIGEN: Record<string, string> = { web: "Reserva web", panel: "Panel", whatsapp: "WhatsApp" };
const EVENTO: Record<string, string> = {
  creada: "Creada",
  reprogramada: "Reprogramada",
  cancelada: "Cancelada",
  estado_cambiado: "Cambio de estado",
  vista: "Vista en el panel",
  revision_resuelta: "Identidad confirmada",
};
const MOMENTO = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", dateStyle: "medium", timeStyle: "short" });

type Props = { params: Promise<{ id: string }> };

function describir(valor: unknown): string {
  if (!valor || typeof valor !== "object") return "";
  const v = valor as Record<string, unknown>;
  if (typeof v.inicio === "string") {
    const inicio = new Date(v.inicio);
    return `${formatearFechaLarga(inicio)} ${horaLocal(inicio)}`;
  }
  if (typeof v.estado === "string") return NOMBRES_ESTADO[v.estado as EstadoCita] ?? v.estado;
  return "";
}

export default async function DetalleCita({ params }: Props) {
  const admin = await requerirPanel();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const detalle = await obtenerDetalleCita(db(), id, { userId: admin.userId });
  if (!detalle) notFound();
  const { cita, eventos, consentimientos } = detalle;

  // Abrir la cita apaga los indicadores de "nueva" y "en revisión".
  const yaVista = Boolean(cita.vista_en);
  if (!yaVista) await marcarCitaVista(db(), cita.id, { actor: { tipo: "usuario", id: admin.userId } });
  const { granularidadMin } = await leerParametros(db());
  const creada = eventos.find((e) => e.tipo === "creada");
  const ingresados = (creada?.detalle as { datos_ingresados?: Record<string, string | null> } | null)?.datos_ingresados;
  const estado = cita.estado as EstadoCita;

  return (
    <div className="grid max-w-3xl gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href={`/admin/agenda?fecha=${fechaLocal(cita.inicio)}&vista=dia`} className="font-sans text-sm text-gris-600 underline underline-offset-4">
          ← Agenda del día
        </Link>
        {!yaVista && <Etiqueta tono="azul">Primera vez que la abres</Etiqueta>}
      </div>

      <div>
        <p className="font-sans text-sm text-gris-600 first-letter:uppercase">{formatearFechaLarga(cita.inicio)}</p>
        <h1 className="mt-1 font-sans text-3xl tabular-nums">
          {horaLocal(cita.inicio)}–{horaLocal(cita.fin)}
        </h1>
        <p className="mt-2 font-sans text-lg">{cita.servicioNombre}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Etiqueta tono={estado === "confirmada" ? "azul" : "neutro"}>{NOMBRES_ESTADO[estado]}</Etiqueta>
          <Etiqueta>{ORIGEN[cita.origen] ?? cita.origen}</Etiqueta>
        </div>
      </div>

      {cita.revision === "documento_con_otro_celular" && !cita.revision_resuelta_en && (
        <section className="grid gap-3">
          <Alerta tono="error">
            <strong className="font-medium">Revisa la identidad.</strong> Esta reserva usó un documento que ya existía, pero desde
            otro celular. La ficha no se modificó y la autorización de datos quedó ligada solo a esta cita. Puede ser un error de
            digitación, un cambio de número o una suplantación: confirma con el titular antes de la cita.
          </Alerta>
          <ResolverRevision citaId={cita.id} />
        </section>
      )}
      {cita.revision_resuelta_en && (
        <Alerta tono="ok">Identidad confirmada el {MOMENTO.format(cita.revision_resuelta_en)}. La autorización quedó vinculada a la ficha.</Alerta>
      )}
      {cita.revision === "sin_documento" && (
        <Alerta tono="error">Reserva sin documento: se creó una ficha nueva. Revisa si la persona ya era paciente.</Alerta>
      )}

      <section className="grid gap-3 border border-gris-200 bg-white p-4 font-sans">
        <h2 className="text-sm uppercase tracking-[0.14em] text-gris-600">Paciente</h2>
        <Link href={`/admin/pacientes/${cita.pacienteId}`} className="text-lg underline-offset-4 hover:underline">
          {cita.pacienteNombre}
        </Link>
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-gris-600">Documento</dt>
            <dd>{formatearDocumento(cita.pacienteTipoDocumento, cita.pacienteNumeroDocumento)}</dd>
          </div>
          <div>
            <dt className="text-gris-600">Celular</dt>
            <dd>
              {cita.pacienteCelular ? (
                <>
                  <a href={`https://wa.me/${cita.pacienteCelular.slice(1)}`} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                    {formatearCelular(cita.pacienteCelular)}
                  </a>{" "}
                  <span className="text-gris-600">{cita.pacienteCelularVerificadoEn ? "· verificado" : "· sin verificar"}</span>
                </>
              ) : (
                "Sin celular"
              )}
            </dd>
          </div>
        </dl>
        {ingresados && (
          <div className="border-t border-gris-200 pt-3 text-sm">
            <p className="text-gris-600">Datos que escribió la persona al reservar:</p>
            <p>
              {ingresados.nombre} · {ingresados.documento ?? "sin documento"} · {ingresados.celular ? formatearCelular(ingresados.celular) : ""}
              {ingresados.correo ? ` · ${ingresados.correo}` : ""}
            </p>
          </div>
        )}
        {consentimientos.map((c) => (
          <p key={c.id} className="border-t border-gris-200 pt-3 text-sm text-gris-600">
            Autorización de datos ({c.version}) aceptada el {MOMENTO.format(c.aceptado_en)}
            {c.aceptante_nombre ? ` por ${c.aceptante_nombre}` : ""}
            {c.aceptante_documento ? ` · ${c.aceptante_documento}` : ""}
            {c.aceptante_celular ? ` · ${formatearCelular(c.aceptante_celular)}` : ""}
            {c.paciente_id ? " · vinculada a la ficha" : " · pendiente de vincular a la ficha"}
          </p>
        ))}
        {cita.notas_internas && <p className="border-t border-gris-200 pt-3 text-sm text-gris-600">{cita.notas_internas}</p>}
      </section>

      <AccionesCita
        citaId={cita.id}
        estado={estado}
        transiciones={transicionesPermitidas(estado).filter((e) => e !== "cancelada")}
        fecha={fechaLocal(cita.inicio)}
        hora={horaLocal(cita.inicio)}
        pasoMinutos={granularidadMin}
      />

      <section className="font-sans">
        <h2 className="text-sm uppercase tracking-[0.14em] text-gris-600">Historial</h2>
        <ol className="mt-3 grid gap-2 text-sm">
          {eventos.map((e) => (
            <li key={e.id} className="flex flex-wrap gap-x-3 border-l-2 border-gris-200 pl-3">
              <span className="tabular-nums text-gris-600">{MOMENTO.format(e.ocurrido_en)}</span>
              <span className="font-medium">{EVENTO[e.tipo] ?? e.tipo}</span>
              {(e.antes || e.despues) && e.tipo !== "creada" && (
                <span className="text-gris-600">
                  {describir(e.antes)} → {describir(e.despues)}
                </span>
              )}
              <span className="text-gris-600">
                · {e.actor_tipo === "usuario" ? "Panel" : e.actor_tipo === "paciente" ? "Paciente" : "Sistema"}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
