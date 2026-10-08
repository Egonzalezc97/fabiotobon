import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirAdmin } from "@/lib/auth/servidor";
import { db } from "@/lib/db";
import { formatearCelular } from "@/lib/telefono";
import { buscarPacientes } from "@/modules/pacientes";
import { formatearDocumento } from "@/modules/pacientes/documento";
import { Boton, Titulo } from "@/components/panel/ui";
import { FormularioFusion } from "./formulario-fusion";

export const metadata: Metadata = { title: "Fusionar fichas" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

async function resumen(id: string) {
  const p = await db()
    .selectFrom("paciente")
    .select(["id", "nombre", "tipo_documento", "numero_documento", "celular", "fusionado_con", "creado_en"])
    .where("id", "=", id)
    .executeTakeFirst();
  if (!p) return null;
  const [citas, tratamientos] = await Promise.all([
    db().selectFrom("cita").select((eb) => eb.fn.countAll<string>().as("n")).where("paciente_id", "=", id).executeTakeFirstOrThrow(),
    db().selectFrom("tratamiento").select((eb) => eb.fn.countAll<string>().as("n")).where("paciente_id", "=", id).executeTakeFirstOrThrow(),
  ]);
  return {
    id: p.id,
    nombre: p.nombre,
    documento: formatearDocumento(p.tipo_documento, p.numero_documento),
    celular: p.celular ? formatearCelular(p.celular) : "—",
    citas: Number(citas.n),
    tratamientos: Number(tratamientos.n),
    fusionada: Boolean(p.fusionado_con),
  };
}

// Solo administradores: unir dos fichas de la misma persona (p. ej. tras una revisión de identidad).
export default async function Fusionar({ params, searchParams }: Props) {
  const admin = await requerirAdmin();
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const actual = await resumen(id);
  if (!actual || actual.fusionada) notFound();
  const termino = typeof sp.q === "string" ? sp.q : "";
  const resultados = termino.trim().length >= 2 ? (await buscarPacientes(db(), termino, { userId: admin.userId })).filter((r) => r.id !== id) : null;
  const otra = typeof sp.otra === "string" && /^[0-9a-f-]{36}$/i.test(sp.otra) && sp.otra !== id ? await resumen(sp.otra) : null;

  return (
    <div className="grid max-w-3xl gap-6">
      <Link href={`/admin/pacientes/${id}`} className="font-sans text-sm text-gris-600 underline underline-offset-4">
        ← {actual.nombre}
      </Link>
      <Titulo>Fusionar fichas</Titulo>
      <p className="font-sans text-sm text-gris-600">
        Une dos fichas de la misma persona. Pasan a la ficha que queda las citas, los tratamientos y los consentimientos. La otra no se
        borra: queda inactiva, sin documento y con el registro de la fusión.
      </p>

      {!otra && (
        <>
          <form className="flex gap-2" role="search">
            <input
              name="q"
              defaultValue={termino}
              aria-label="Buscar la otra ficha"
              placeholder="Nombre, documento o celular de la otra ficha"
              className="min-h-11 flex-1 rounded-[2px] border border-gris-200 bg-white px-3 font-sans outline-none focus:border-azul"
            />
            <Boton variante="secundario">Buscar</Boton>
          </form>
          {resultados && (
            <ul className="divide-y divide-gris-200 border border-gris-200 bg-white font-sans">
              {resultados.length === 0 && <li className="px-4 py-3 text-sm text-gris-600">Sin resultados.</li>}
              {resultados.map((r) => (
                <li key={r.id}>
                  <Link href={`/admin/pacientes/${id}/fusionar?otra=${r.id}`} className="flex min-h-12 items-center justify-between gap-2 px-4 py-2 hover:bg-papel">
                    <span>{r.nombre}</span>
                    <span className="text-sm text-gris-600">{formatearDocumento(r.tipo_documento, r.numero_documento)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {otra && (otra.fusionada ? <p className="font-sans text-sm text-red-700">Esa ficha ya fue fusionada.</p> : <FormularioFusion actual={actual} otra={otra} />)}
    </div>
  );
}
