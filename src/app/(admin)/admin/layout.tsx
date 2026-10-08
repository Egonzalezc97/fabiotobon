import type { Metadata } from "next";
import Link from "next/link";
import { requerirPanel } from "@/lib/auth/servidor";
import { db } from "@/lib/db";
import { datosSitio } from "@/lib/sitio";
import { contarPendientesDeRevisar } from "@/modules/agenda/consultas";
import { BotonCerrarSesion } from "../boton-cerrar-sesion";
import { Navegacion } from "./navegacion";

export const metadata: Metadata = {
  title: "Panel",
  robots: { index: false, follow: false },
};

export default async function LayoutAdmin({ children }: { children: React.ReactNode }) {
  // La autorización se decide aquí, en el servidor, en cada petición (y además en cada página y acción).
  const admin = await requerirPanel();
  const [pendientes, { modoDemo }] = await Promise.all([contarPendientesDeRevisar(db()), datosSitio()]);
  const totalPorRevisar = pendientes.webNuevas + pendientes.enRevision;

  return (
    <div className="min-h-dvh bg-papel">
      {modoDemo && (
        <div className="bg-azul px-4 py-1.5 text-center font-sans text-xs font-medium uppercase tracking-[0.14em] text-white">
          Datos de demostración
        </div>
      )}
      <header className="border-b border-gris-200 bg-white">
        <div className="mx-auto flex max-w-[96rem] items-center justify-between gap-4 px-4 py-3 md:px-6">
          <Link href="/admin/agenda" className="font-sans text-[0.9375rem] font-medium">
            Panel · Fabio Tobón
          </Link>
          <div className="flex items-center gap-4">
            {totalPorRevisar > 0 && (
              <Link
                href="/admin/por-revisar"
                className="inline-flex min-h-9 items-center gap-2 rounded-[2px] bg-azul px-3 font-sans text-sm text-white"
              >
                <span className="tabular-nums">{totalPorRevisar}</span> por revisar
              </Link>
            )}
            <span className="hidden font-sans text-sm text-gris-600 md:inline">
              {admin.nombre} · {admin.rol === "admin" ? "Administrador" : "Asistente"}
            </span>
            <BotonCerrarSesion />
          </div>
        </div>
        <Navegacion webNuevas={pendientes.webNuevas} enRevision={pendientes.enRevision} esAdmin={admin.rol === "admin"} />
      </header>
      <main className="mx-auto max-w-[96rem] px-4 py-6 md:px-6 md:py-8">{children}</main>
    </div>
  );
}
