import type { Metadata } from "next";
import Link from "next/link";
import { requerirAdmin } from "@/lib/auth/servidor";
import { db } from "@/lib/db";
import { buscarPacientes } from "@/modules/pacientes";
import { formatearDocumento } from "@/modules/pacientes/documento";
import { fechaLocal } from "@/modules/agenda/tiempo";
import { Boton, Titulo } from "@/components/panel/ui";
import { FormularioConsentimientoImagen } from "./formulario-consentimiento";

export const metadata: Metadata = { title: "Consentimiento de uso de imagen" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const uno = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

export default async function NuevoConsentimientoImagen({ searchParams }: Props) {
  const admin = await requerirAdmin();
  const sp = await searchParams;
  const volver = /^[0-9a-f-]{36}$/i.test(uno(sp.volver)) ? uno(sp.volver) : "";
  const termino = uno(sp.q);
  const resultados = termino.trim().length >= 2 ? await buscarPacientes(db(), termino, { userId: admin.userId }) : null;
  const pacienteId = /^[0-9a-f-]{36}$/i.test(uno(sp.paciente)) ? uno(sp.paciente) : "";
  const paciente = pacienteId
    ? await db().selectFrom("paciente").select(["id", "nombre", "tipo_documento", "numero_documento"]).where("id", "=", pacienteId).where("fusionado_con", "is", null).executeTakeFirst()
    : undefined;
  const conVolver = (extra: string) => `/admin/galeria/consentimientos/nuevo?${volver ? `volver=${volver}&` : ""}${extra}`;

  return (
    <div className="grid max-w-3xl gap-6">
      <Link href={volver ? `/admin/galeria/${volver}` : "/admin/galeria"} className="font-sans text-sm text-gris-600 underline underline-offset-4">
        ← {volver ? "Volver al caso" : "Galería"}
      </Link>
      <Titulo>Consentimiento de uso de imagen</Titulo>
      <p className="font-sans text-sm text-gris-600">
        Registra la autorización escrita del paciente para publicar sus fotos. Adjunta el documento firmado o marca que está en físico e
        indica quién lo verificó. El registro no se puede editar ni borrar.
      </p>

      {!paciente ? (
        <>
          <form className="flex gap-2" role="search">
            {volver && <input type="hidden" name="volver" value={volver} />}
            <input
              name="q"
              defaultValue={termino}
              aria-label="Buscar paciente"
              placeholder="Nombre, documento o celular del paciente"
              className="min-h-11 flex-1 rounded-[2px] border border-gris-200 bg-white px-3 font-sans outline-none focus:border-azul"
            />
            <Boton variante="secundario">Buscar</Boton>
          </form>
          {resultados && (
            <ul className="divide-y divide-gris-200 border border-gris-200 bg-white font-sans">
              {resultados.length === 0 && <li className="px-4 py-3 text-sm text-gris-600">Sin resultados.</li>}
              {resultados.map((r) => (
                <li key={r.id}>
                  <Link href={conVolver(`paciente=${r.id}`)} className="flex min-h-12 items-center justify-between gap-2 px-4 py-2 hover:bg-papel">
                    <span>{r.nombre}</span>
                    <span className="text-sm text-gris-600">{formatearDocumento(r.tipo_documento, r.numero_documento)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <>
          <p className="font-sans">
            Paciente: <strong className="font-medium">{paciente.nombre}</strong> · {formatearDocumento(paciente.tipo_documento, paciente.numero_documento)}{" "}
            <Link href={conVolver("")} className="text-sm text-azul underline underline-offset-4">
              Cambiar
            </Link>
          </p>
          <FormularioConsentimientoImagen pacienteId={paciente.id} hoy={fechaLocal(new Date())} volver={volver ? `/admin/galeria/${volver}` : "/admin/galeria/nuevo"} />
        </>
      )}
    </div>
  );
}
