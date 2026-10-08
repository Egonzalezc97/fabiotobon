import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { EnlaceWhatsapp } from "@/components/publico/enlaces";
import { TextoOPendiente } from "@/components/publico/pendiente";
import { datosSitio } from "@/lib/sitio";
import { resumenReservaCompletada } from "@/modules/agenda/reserva-publica";
import { Contenedor, Encabezado, ResumenCita } from "../_ui";
import { db, leerTokenReserva } from "../comun";

export const metadata: Metadata = { title: "Reserva confirmada" };

export default async function Listo() {
  await connection();
  const cita = await resumenReservaCompletada(db(), await leerTokenReserva(), new Date());
  if (!cita) redirect("/reservar");
  const { contacto } = await datosSitio();
  const pendiente = cita.estado === "pendiente";

  return (
    <Contenedor>
      <Encabezado titulo={pendiente ? "Recibimos tu solicitud." : "Tu valoración quedó agendada."}>
        {pendiente
          ? "Fabio la revisará y te confirmará el horario."
          : "Te esperamos. Si necesitas cambiarla, escríbenos por WhatsApp."}
      </Encabezado>
      <ResumenCita
        servicio={{ nombre: cita.servicioNombre, duracionMin: Math.round((cita.fin.getTime() - cita.inicio.getTime()) / 60_000) }}
        inicio={cita.inicio}
      />
      <dl className="mt-6 max-w-xl font-sans">
        <dt className="text-xs uppercase tracking-[0.2em] text-gris-600">Dónde</dt>
        <dd className="mt-1">
          <TextoOPendiente texto={contacto.direccion} dato="dirección" />
        </dd>
      </dl>
      <p className="mt-10 max-w-xl border-l-2 border-azul bg-papel px-4 py-3 font-sans text-[0.9375rem]">
        Guarda esta información: todavía no enviamos mensajes de confirmación ni recordatorios.
      </p>
      <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-5">
        <EnlaceWhatsapp numero={contacto.whatsapp} className="text-gris-800" />
        <Link href="/" className="font-sans text-[0.9375rem] text-gris-600 underline-offset-[6px] hover:underline">
          Volver al inicio
        </Link>
      </div>
    </Contenedor>
  );
}
