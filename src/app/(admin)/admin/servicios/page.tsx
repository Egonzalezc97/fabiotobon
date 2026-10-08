import type { Metadata } from "next";
import Link from "next/link";
import { requerirAdmin } from "@/lib/auth/servidor";
import { db } from "@/lib/db";
import { formatearDuracion, formatearPrecio, listarServiciosPanel, POLITICAS_RESERVA, type PoliticaReserva } from "@/modules/servicios";
import { EnlaceBoton, Etiqueta, Titulo } from "@/components/panel/ui";

export const metadata: Metadata = { title: "Servicios" };

export default async function Servicios() {
  await requerirAdmin();
  const servicios = await listarServiciosPanel(db());
  return (
    <div className="grid max-w-3xl gap-6">
      <Titulo accion={<EnlaceBoton href="/admin/servicios/nuevo">Nuevo servicio</EnlaceBoton>}>Servicios</Titulo>
      <ul className="divide-y divide-gris-200 border border-gris-200 bg-white font-sans">
        {servicios.map((s) => (
          <li key={s.id}>
            <Link href={`/admin/servicios/${s.id}`} className={`flex min-h-14 flex-wrap items-center justify-between gap-2 px-4 py-2 hover:bg-papel ${s.activo ? "" : "text-gris-600"}`}>
              <span>
                {s.nombre}
                <span className="block text-sm text-gris-600">{POLITICAS_RESERVA[s.politica_reserva as PoliticaReserva] ?? s.politica_reserva}</span>
              </span>
              <span className="flex flex-wrap items-center gap-2 text-sm tabular-nums">
                {formatearDuracion(s.duracion_min)}
                {s.precio_cop !== null && <span className={s.mostrar_precio ? "" : "text-gris-600"}>· {formatearPrecio(s.precio_cop)}</span>}
                {!s.activo && <Etiqueta>Inactivo</Etiqueta>}
                {s.activo && !s.visible_en_landing && <Etiqueta>Oculto</Etiqueta>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
