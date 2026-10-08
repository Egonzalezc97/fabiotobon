import type { Metadata } from "next";
import Link from "next/link";
import { requerirPanel } from "@/lib/auth/servidor";
import { db } from "@/lib/db";
import { formatearCelular } from "@/lib/telefono";
import { buscarPacientes } from "@/modules/pacientes";
import { formatearDocumento } from "@/modules/pacientes/documento";
import { Boton, EnlaceBoton, Titulo } from "@/components/panel/ui";

export const metadata: Metadata = { title: "Pacientes" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

// Búsqueda mínima para agendar. El CRM completo (tabla, filtros, pagos) es la fase 4.
export default async function Pacientes({ searchParams }: Props) {
  const admin = await requerirPanel();
  const { q } = await searchParams;
  const termino = typeof q === "string" ? q : "";
  const resultados = termino.trim().length >= 2 ? await buscarPacientes(db(), termino, { userId: admin.userId }) : null;

  return (
    <div className="grid max-w-3xl gap-6">
      <Titulo accion={<EnlaceBoton href="/admin/pacientes/nuevo">Nuevo paciente</EnlaceBoton>}>Pacientes</Titulo>
      <form className="flex gap-2" role="search">
        <input
          name="q"
          defaultValue={termino}
          aria-label="Buscar paciente"
          placeholder="Nombre, documento o celular"
          className="min-h-11 flex-1 rounded-[2px] border border-gris-200 bg-white px-3 font-sans outline-none focus:border-azul"
        />
        <Boton variante="secundario">Buscar</Boton>
      </form>
      {resultados === null ? (
        <p className="font-sans text-sm text-gris-600">Escribe al menos dos caracteres. Cada búsqueda queda registrada.</p>
      ) : resultados.length === 0 ? (
        <p className="font-sans text-sm text-gris-600">Sin resultados.</p>
      ) : (
        <ul className="divide-y divide-gris-200 border border-gris-200 bg-white">
          {resultados.map((p) => (
            <li key={p.id}>
              <Link href={`/admin/pacientes/${p.id}`} prefetch={false} className="flex min-h-14 flex-wrap items-center justify-between gap-2 px-4 py-2 font-sans hover:bg-papel">
                <span>
                  {p.nombre} {p.estado === "inactivo" && <span className="text-sm text-gris-600">(inactivo)</span>}
                </span>
                <span className="text-sm tabular-nums text-gris-600">
                  {formatearDocumento(p.tipo_documento, p.numero_documento)}
                  {p.celular ? ` · ${formatearCelular(p.celular)}` : ""}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
