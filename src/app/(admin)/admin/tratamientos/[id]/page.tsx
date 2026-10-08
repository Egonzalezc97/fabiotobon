import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirPanel } from "@/lib/auth/servidor";
import { db } from "@/lib/db";
import { fechaLocal } from "@/modules/agenda/tiempo";
import {
  NOMBRES_ESTADO_PAGO,
  NOMBRES_ESTADO_TRATAMIENTO,
  NOMBRES_MEDIO,
  obtenerTratamiento,
  transicionesTratamiento,
  type EstadoPago,
  type EstadoTratamiento,
  type MedioAbono,
} from "@/modules/tratamientos";
import { formatearPrecio } from "@/modules/servicios";
import { Etiqueta, Titulo } from "@/components/panel/ui";
import { AjustarCosto, AnularAbono, CambiarEstado, CancelarTratamiento, RegistrarAbono } from "../formularios";

export const metadata: Metadata = { title: "Tratamiento" };

type Props = { params: Promise<{ id: string }> };

const MOMENTO = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", dateStyle: "medium", timeStyle: "short" });
const EVENTO: Record<string, string> = {
  creado: "Creado",
  costo_ajustado: "Costo ajustado",
  estado_cambiado: "Cambio de estado",
  cancelado: "Cancelado",
  abono_registrado: "Abono registrado",
  abono_anulado: "Abono anulado",
  paciente_cambiado: "Movido por fusión de fichas",
  editado: "Editado",
};

function describir(e: { tipo: string; antes: unknown; despues: unknown }) {
  const a = (e.antes ?? {}) as Record<string, number | string>;
  const d = (e.despues ?? {}) as Record<string, number | string>;
  if (e.tipo === "costo_ajustado") return `${formatearPrecio(Number(a.costo_total))} → ${formatearPrecio(Number(d.costo_total))}`;
  if (e.tipo === "estado_cambiado") return `${NOMBRES_ESTADO_TRATAMIENTO[a.estado as EstadoTratamiento] ?? a.estado} → ${NOMBRES_ESTADO_TRATAMIENTO[d.estado as EstadoTratamiento] ?? d.estado}`;
  if (e.tipo === "abono_registrado") return `${formatearPrecio(Number(d.valor))} · ${NOMBRES_MEDIO[d.medio as MedioAbono] ?? d.medio}`;
  if (e.tipo === "abono_anulado") return formatearPrecio(Number(a.valor));
  if (e.tipo === "cancelado") return `valor realizado ${formatearPrecio(Number(d.valor_realizado))}`;
  return "";
}

export default async function DetalleTratamiento({ params }: Props) {
  const usuario = await requerirPanel();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const detalle = await obtenerTratamiento(db(), id, { userId: usuario.userId });
  if (!detalle) notFound();
  const { tratamiento: t, abonos, eventos } = detalle;
  const estado = t.estado as EstadoTratamiento;
  const cancelado = estado === "cancelado";

  return (
    <div className="grid max-w-3xl gap-6">
      <Link href={`/admin/pacientes/${t.paciente_id}?pestana=tratamientos`} className="font-sans text-sm text-gris-600 underline underline-offset-4">
        ← {t.pacienteNombre}
      </Link>
      <Titulo>{t.servicioNombre ?? t.descripcion}</Titulo>
      {t.servicioNombre && t.descripcion && <p className="-mt-3 font-sans text-gris-600">{t.descripcion}</p>}
      <div className="flex flex-wrap gap-2">
        <Etiqueta tono={estado === "en_curso" ? "azul" : "neutro"}>{NOMBRES_ESTADO_TRATAMIENTO[estado]}</Etiqueta>
        <Etiqueta tono={t.estado_pago === "con_saldo" || t.estado_pago === "sin_abonos" ? "alerta" : "neutro"}>
          {NOMBRES_ESTADO_PAGO[t.estado_pago as EstadoPago] ?? t.estado_pago}
        </Etiqueta>
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border border-gris-200 bg-white p-4 font-sans sm:grid-cols-4">
        <div>
          <dt className="text-xs uppercase tracking-[0.14em] text-gris-600">{cancelado ? "Valor realizado" : "Costo total"}</dt>
          <dd className="mt-1 text-lg tabular-nums">{formatearPrecio(t.base ?? 0)}</dd>
          {t.costo_inicial !== t.costo_total && !cancelado && (
            <dd className="text-xs text-gris-600">Inicial: {formatearPrecio(t.costo_inicial)}</dd>
          )}
        </div>
        <div>
          <dt className="text-xs uppercase tracking-[0.14em] text-gris-600">Abonado</dt>
          <dd className="mt-1 text-lg tabular-nums">{formatearPrecio(t.abonado ?? 0)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-[0.14em] text-gris-600">{(t.saldo ?? 0) < 0 ? "Saldo a favor" : "Saldo"}</dt>
          <dd className={`mt-1 text-lg tabular-nums ${(t.saldo ?? 0) > 0 ? "text-red-700" : ""}`}>{formatearPrecio(Math.abs(t.saldo ?? 0))}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-[0.14em] text-gris-600">Fechas</dt>
          <dd className="mt-1 text-sm tabular-nums">
            {t.fecha_inicio ?? "—"} {t.fecha_fin ? `→ ${t.fecha_fin}` : ""}
          </dd>
        </div>
      </dl>

      <RegistrarAbono tratamientoId={t.id} hoy={fechaLocal(new Date())} />

      <section className="grid gap-3">
        <h2 className="font-sans text-sm uppercase tracking-[0.14em] text-gris-600">Abonos · {abonos.length}</h2>
        {abonos.length === 0 ? (
          <p className="font-sans text-sm text-gris-600">Sin abonos.</p>
        ) : (
          <ul className="divide-y divide-gris-200 border border-gris-200 bg-white font-sans">
            {abonos.map((a) => (
              <li key={a.id} className={`flex flex-wrap items-start justify-between gap-3 px-4 py-3 ${a.anulado_en ? "text-gris-600" : ""}`}>
                <span>
                  <span className={`tabular-nums ${a.anulado_en ? "line-through" : "font-medium"}`}>{formatearPrecio(a.valor)}</span>
                  <span className="block text-sm text-gris-600">
                    {a.fecha} · {NOMBRES_MEDIO[a.medio as MedioAbono] ?? a.medio}
                    {a.referencia ? ` · ${a.referencia}` : ""}
                    {a.confirma_saldo_a_favor ? " · confirmó saldo a favor" : ""}
                  </span>
                  {a.anulado_en && <span className="block text-sm">Anulado: {a.motivo_anulacion}</span>}
                </span>
                {!a.anulado_en && <AnularAbono tratamientoId={t.id} abonoId={a.id} />}
              </li>
            ))}
          </ul>
        )}
      </section>

      {!cancelado && (
        <>
          <CambiarEstado
            tratamientoId={t.id}
            opciones={transicionesTratamiento(estado).map((e) => ({ valor: e, nombre: NOMBRES_ESTADO_TRATAMIENTO[e] }))}
          />
          <AjustarCosto tratamientoId={t.id} costoActual={t.costo_total} />
          <CancelarTratamiento tratamientoId={t.id} abonado={t.abonado ?? 0} />
        </>
      )}

      <section className="font-sans">
        <h2 className="text-sm uppercase tracking-[0.14em] text-gris-600">Historial</h2>
        <ol className="mt-3 grid gap-2 text-sm">
          {eventos.map((e) => (
            <li key={e.id} className="border-l-2 border-gris-200 pl-3">
              <span className="tabular-nums text-gris-600">{MOMENTO.format(e.ocurrido_en)}</span> <span className="font-medium">{EVENTO[e.tipo] ?? e.tipo}</span>{" "}
              <span className="text-gris-600">{describir(e)}</span>
              {e.motivo && <span className="block text-gris-600">Motivo: {e.motivo}</span>}
              {e.actorNombre && <span className="block text-xs text-gris-600">Por {e.actorNombre}</span>}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
