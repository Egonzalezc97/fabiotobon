import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirPanel } from "@/lib/auth/servidor";
import { db } from "@/lib/db";
import { formatearCelular } from "@/lib/telefono";
import { NOMBRES_ESTADO, type EstadoCita } from "@/modules/agenda/estados";
import { formatearFechaLarga, horaLocal } from "@/modules/agenda/tiempo";
import { obtenerFicha } from "@/modules/pacientes";
import { formatearDocumento, TIPOS_DOCUMENTO } from "@/modules/pacientes/documento";
import { formatearPrecio, listarServiciosPanel } from "@/modules/servicios";
import {
  listarTratamientosPaciente,
  NOMBRES_ESTADO_PAGO,
  NOMBRES_ESTADO_TRATAMIENTO,
  type EstadoPago,
  type EstadoTratamiento,
} from "@/modules/tratamientos";
import { Alerta, EnlaceBoton, Etiqueta, Titulo } from "@/components/panel/ui";
import { NuevoTratamiento } from "../../tratamientos/formularios";
import { FormularioPaciente } from "../formulario-paciente";

export const metadata: Metadata = { title: "Paciente" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

const PESTANAS = [
  { id: "datos", nombre: "Datos" },
  { id: "citas", nombre: "Citas" },
  { id: "tratamientos", nombre: "Tratamientos y abonos" },
  { id: "consentimientos", nombre: "Consentimientos" },
  { id: "historial", nombre: "Historial" },
] as const;
type Pestana = (typeof PESTANAS)[number]["id"];

const MOMENTO = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", dateStyle: "medium", timeStyle: "short" });
const CAMPO: Record<string, string> = {
  tipo_documento: "Tipo de documento",
  numero_documento: "Número de documento",
  nombre: "Nombre",
  celular: "WhatsApp",
  telefono: "Teléfono",
  correo: "Correo",
  fecha_nacimiento: "Fecha de nacimiento",
  estado: "Estado",
  notas: "Notas",
};
const TIPO_EVENTO: Record<string, string> = {
  creado: "Ficha creada",
  actualizado: "Datos editados",
  fusion_recibida: "Recibió una ficha fusionada",
  fusion_absorbida: "Fusionada en otra ficha",
};

export default async function FichaPaciente({ params, searchParams }: Props) {
  const usuario = await requerirPanel();
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const ficha = await obtenerFicha(db(), id, { userId: usuario.userId });
  if (!ficha) notFound();
  const { paciente, citas, cartera, consentimientos, eventos } = ficha;
  const pestana: Pestana = PESTANAS.some((p) => p.id === sp.pestana) ? (sp.pestana as Pestana) : "datos";
  const ahora = new Date();
  const saldo = cartera?.saldo ?? 0;

  return (
    <div className="grid max-w-4xl gap-6">
      <Titulo accion={!paciente.fusionado_con && <EnlaceBoton href={`/admin/agenda/nueva?pacienteId=${paciente.id}`}>Nueva cita</EnlaceBoton>}>
        {paciente.nombre}
      </Titulo>
      {paciente.fusionado_con && (
        <Alerta tono="info">
          Esta ficha se fusionó con otra.{" "}
          <Link href={`/admin/pacientes/${paciente.fusionado_con}`} className="underline">
            Ir a la ficha que quedó
          </Link>
        </Alerta>
      )}

      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border border-gris-200 bg-white p-4 font-sans text-sm sm:grid-cols-4">
        <div>
          <dt className="text-gris-600">Documento</dt>
          <dd>{formatearDocumento(paciente.tipo_documento, paciente.numero_documento)}</dd>
        </div>
        <div>
          <dt className="text-gris-600">WhatsApp</dt>
          <dd>{paciente.celular ? `${formatearCelular(paciente.celular)}${paciente.celular_verificado_en ? " · verificado" : ""}` : "—"}</dd>
        </div>
        <div>
          <dt className="text-gris-600">Estado de pago</dt>
          <dd>{NOMBRES_ESTADO_PAGO[(cartera?.estado_pago ?? "sin_tratamientos") as EstadoPago]}</dd>
        </div>
        <div>
          <dt className="text-gris-600">{saldo < 0 ? "Saldo a favor" : "Saldo pendiente"}</dt>
          <dd className={`tabular-nums ${saldo > 0 ? "text-red-700" : ""}`}>{formatearPrecio(Math.abs(saldo))}</dd>
        </div>
      </dl>

      <nav aria-label="Secciones de la ficha" className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <ul className="flex gap-1 border-b border-gris-200 font-sans text-sm">
          {PESTANAS.map((p) => (
            <li key={p.id}>
              <Link
                href={`/admin/pacientes/${paciente.id}?pestana=${p.id}`}
                prefetch={false}
                scroll={false}
                aria-current={p.id === pestana ? "page" : undefined}
                className={`flex min-h-11 items-center whitespace-nowrap border-b-2 px-3 ${
                  p.id === pestana ? "border-gris-800 text-gris-800" : "border-transparent text-gris-600 hover:text-gris-800"
                }`}
              >
                {p.nombre}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {pestana === "datos" && (
        <section className="grid gap-4">
          {!paciente.fusionado_con && (
            <FormularioPaciente paciente={paciente} tiposDocumento={Object.entries(TIPOS_DOCUMENTO).map(([valor, nombre]) => ({ valor, nombre }))} />
          )}
          {usuario.rol === "admin" && !paciente.fusionado_con && (
            <p className="font-sans text-sm">
              ¿Es la misma persona que otra ficha?{" "}
              <Link href={`/admin/pacientes/${paciente.id}/fusionar`} className="text-azul underline underline-offset-4">
                Fusionar fichas
              </Link>
            </p>
          )}
        </section>
      )}

      {pestana === "citas" && (
        <section className="grid gap-6">
          {[
            { titulo: "Próximas", lista: citas.filter((c) => c.inicio > ahora && (c.estado === "pendiente" || c.estado === "confirmada")).reverse() },
            { titulo: "Anteriores", lista: citas.filter((c) => c.inicio <= ahora && c.estado !== "cancelada") },
            { titulo: "Canceladas", lista: citas.filter((c) => c.estado === "cancelada") },
            { titulo: "Reprogramadas alguna vez", lista: citas.filter((c) => c.fueReprogramada) },
          ].map((grupo) => (
            <div key={grupo.titulo} className="grid gap-2">
              <h2 className="font-sans text-sm uppercase tracking-[0.14em] text-gris-600">
                {grupo.titulo} · {grupo.lista.length}
              </h2>
              {grupo.lista.length > 0 && (
                <ul className="divide-y divide-gris-200 border border-gris-200 bg-white font-sans">
                  {grupo.lista.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/admin/citas/${c.id}`}
                        prefetch={false}
                        className="flex min-h-12 flex-wrap items-center justify-between gap-2 px-4 py-2 hover:bg-papel"
                      >
                        <span className="inline-block first-letter:uppercase">
                          {formatearFechaLarga(c.inicio)} · {horaLocal(c.inicio)}
                        </span>
                        <span className="text-sm text-gris-600">
                          {c.servicioNombre} · {NOMBRES_ESTADO[c.estado as EstadoCita] ?? c.estado}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>
      )}

      {pestana === "tratamientos" && <PestanaTratamientos pacienteId={paciente.id} activo={!paciente.fusionado_con} />}

      {pestana === "consentimientos" && (
        <section className="grid gap-2">
          {consentimientos.length === 0 ? (
            <p className="font-sans text-sm text-gris-600">Sin consentimientos registrados.</p>
          ) : (
            <ul className="divide-y divide-gris-200 border border-gris-200 bg-white font-sans text-sm">
              {consentimientos.map((c) => (
                <li key={c.id} className="px-4 py-3">
                  Tratamiento de datos · versión {c.version} · {MOMENTO.format(c.aceptado_en)} · {c.origen === "web" ? "reserva web" : "panel"}
                  {c.aceptante_nombre ? ` · aceptado por ${c.aceptante_nombre}` : ""}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {pestana === "historial" && (
        <section className="font-sans">
          <ol className="grid gap-3 text-sm">
            {eventos.map((e) => (
              <li key={e.id} className="border-l-2 border-gris-200 pl-3">
                <span className="tabular-nums text-gris-600">{MOMENTO.format(e.ocurrido_en)}</span>{" "}
                <span className="font-medium">{TIPO_EVENTO[e.tipo] ?? e.tipo}</span>
                {e.actorNombre && <span className="text-gris-600"> · por {e.actorNombre}</span>}
                {e.actor_tipo === "paciente" && <span className="text-gris-600"> · desde la reserva web</span>}
                {e.tipo === "actualizado" && (
                  <ul className="mt-1 text-gris-600">
                    {Object.entries(e.cambios as Record<string, { antes: unknown; despues: unknown }>).map(([campo, v]) => (
                      <li key={campo}>
                        {CAMPO[campo] ?? campo}: {String(v.antes ?? "—")} → {String(v.despues ?? "—")}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

async function PestanaTratamientos({ pacienteId, activo }: { pacienteId: string; activo: boolean }) {
  const [tratamientos, servicios] = await Promise.all([
    listarTratamientosPaciente(db(), pacienteId),
    listarServiciosPanel(db(), { soloActivos: true }),
  ]);
  return (
    <section className="grid gap-4">
      {tratamientos.length === 0 ? (
        <p className="font-sans text-sm text-gris-600">Sin tratamientos.</p>
      ) : (
        <ul className="divide-y divide-gris-200 border border-gris-200 bg-white font-sans">
          {tratamientos.map((t) => (
            <li key={t.id}>
              <Link
                href={`/admin/tratamientos/${t.id}`}
                prefetch={false}
                className="grid gap-1 px-4 py-3 hover:bg-papel sm:grid-cols-[1fr_auto] sm:items-center"
              >
                <span>
                  {t.servicioNombre ?? t.descripcion}
                  <span className="ml-2 inline-flex gap-1 align-middle">
                    <Etiqueta>{NOMBRES_ESTADO_TRATAMIENTO[t.estado as EstadoTratamiento]}</Etiqueta>
                    <Etiqueta tono={t.estado_pago === "con_saldo" || t.estado_pago === "sin_abonos" ? "alerta" : "neutro"}>
                      {NOMBRES_ESTADO_PAGO[t.estado_pago as EstadoPago] ?? t.estado_pago}
                    </Etiqueta>
                  </span>
                </span>
                <span className="text-sm tabular-nums text-gris-600">
                  {formatearPrecio(t.base ?? 0)} · abonado {formatearPrecio(t.abonado ?? 0)} ·{" "}
                  <span className={(t.saldo ?? 0) > 0 ? "text-red-700" : ""}>
                    {(t.saldo ?? 0) < 0 ? "a favor" : "saldo"} {formatearPrecio(Math.abs(t.saldo ?? 0))}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {activo && <NuevoTratamiento pacienteId={pacienteId} servicios={servicios.map((s) => ({ id: s.id, nombre: s.nombre }))} />}
    </section>
  );
}
