import type { Metadata } from "next";
import Link from "next/link";
import { requerirPanel } from "@/lib/auth/servidor";
import { db } from "@/lib/db";
import { listarCitasAgenda } from "@/modules/agenda/consultas";
import { fechaLocal, horaLocal, mesDe, nombreMes, rangoDia } from "@/modules/agenda/tiempo";
import { formatearPrecio } from "@/modules/servicios";
import { resumenCartera } from "@/modules/tratamientos";
import { Alerta, Titulo } from "@/components/panel/ui";

export const metadata: Metadata = { title: "Inicio" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function Cifra({ titulo, valor, detalle }: { titulo: string; valor: string; detalle?: string }) {
  return (
    <div className="border border-gris-200 bg-white p-4">
      <dt className="font-sans text-xs uppercase tracking-[0.14em] text-gris-600">{titulo}</dt>
      <dd className="mt-2 font-sans text-2xl tabular-nums">{valor}</dd>
      {detalle && <dd className="mt-1 font-sans text-xs text-gris-600">{detalle}</dd>}
    </div>
  );
}

export default async function PanelInicio({ searchParams }: Props) {
  // Next renderiza layout y página en paralelo: cada página verifica por su cuenta, no confía en el layout.
  const usuario = await requerirPanel();
  const { aviso } = await searchParams;
  const hoy = fechaLocal(new Date());
  const mes = mesDe(hoy);
  const [cartera, citasHoy] = await Promise.all([resumenCartera(db(), mes), listarCitasAgenda(db(), rangoDia(hoy))]);

  return (
    <div className="grid max-w-4xl gap-8">
      <Titulo>Hola, {usuario.nombre.split(" ")[0]}</Titulo>
      {aviso === "sin-permiso" && <Alerta tono="error">Tu rol no tiene acceso a esa sección.</Alerta>}

      <section className="grid gap-3">
        <h2 className="font-sans text-sm uppercase tracking-[0.14em] text-gris-600">Cartera</h2>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Cifra titulo="Total por cobrar" valor={formatearPrecio(cartera.porCobrar)} detalle="Tratamientos en curso, terminados o cancelados" />
          <Cifra titulo="Pacientes con saldo" valor={String(cartera.pacientesConSaldo)} />
          <Cifra titulo="Abonos del mes" valor={formatearPrecio(cartera.abonosDelMes)} detalle={nombreMes(mes)} />
          <Cifra titulo="Presupuestado" valor={formatearPrecio(cartera.presupuestado)} detalle="Aún no es deuda (DPF)" />
        </dl>
        <Link href="/admin/pacientes?pago=con_saldo" className="font-sans text-sm text-azul underline underline-offset-4">
          Ver pacientes con saldo
        </Link>
      </section>

      <section className="grid gap-3">
        <h2 className="font-sans text-sm uppercase tracking-[0.14em] text-gris-600">Hoy · {citasHoy.length} citas</h2>
        {citasHoy.length === 0 ? (
          <p className="font-sans text-sm text-gris-600">No hay citas hoy.</p>
        ) : (
          <ul className="divide-y divide-gris-200 border border-gris-200 bg-white font-sans">
            {citasHoy.map((c) => (
              <li key={c.id}>
                <Link href={`/admin/citas/${c.id}`} prefetch={false} className="flex min-h-12 items-center justify-between gap-3 px-4 py-2 hover:bg-papel">
                  <span className="tabular-nums">{horaLocal(c.inicio)}</span>
                  <span className="flex-1">{c.pacienteNombre}</span>
                  <span className="text-sm text-gris-600">{c.servicioNombre}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Link href="/admin/agenda" className="font-sans text-sm text-azul underline underline-offset-4">
          Abrir la agenda
        </Link>
      </section>
    </div>
  );
}
