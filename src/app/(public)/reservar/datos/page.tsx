import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { datosSitio } from "@/lib/sitio";
import { cuposPublicos, estadoReservaPublica, serviciosReservables } from "@/modules/agenda/reserva-publica";
import { fechaLocal } from "@/modules/agenda/tiempo";
import { TIPOS_DOCUMENTO } from "@/modules/pacientes/documento";
import { Contenedor, Encabezado, NoDisponible, ResumenCita } from "../_ui";
import { db, entornoReserva } from "../comun";
import { FormularioDatos } from "./formulario-datos";

export const metadata: Metadata = { title: "Tus datos · Agendar valoración" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function Datos({ searchParams }: Props) {
  await connection();
  const sp = await searchParams;
  const { contacto } = await datosSitio();
  const estado = await estadoReservaPublica(db(), entornoReserva());
  if (!estado.disponible) return <NoDisponible whatsapp={contacto.whatsapp} />;

  const servicio = (await serviciosReservables(db())).find((s) => s.slug === sp.servicio);
  const inicio = typeof sp.inicio === "string" ? new Date(sp.inicio) : null;
  if (!servicio || !inicio || Number.isNaN(inicio.getTime())) redirect("/reservar");

  // El horario debe seguir siendo un cupo libre; si no, de vuelta a elegir con aviso.
  const fecha = fechaLocal(inicio);
  const cupos = await cuposPublicos(db(), servicio, new Date(), { desde: fecha, hasta: fecha });
  if (!cupos.some((c) => c.getTime() === inicio.getTime())) redirect(`/reservar?fecha=${fecha}&aviso=ocupado`);

  return (
    <Contenedor>
      <Encabezado paso="Paso 2 de 3" titulo="Tus datos.">
        Te enviaremos un código a tu celular para confirmar que es tuyo.
      </Encabezado>
      <ResumenCita servicio={servicio} inicio={inicio} cambiar={`/reservar?fecha=${fecha}`} />
      <FormularioDatos
        servicioId={servicio.id}
        inicio={inicio.toISOString()}
        documentoObligatorio={estado.documentoObligatorio}
        tiposDocumento={Object.entries(TIPOS_DOCUMENTO).map(([valor, nombre]) => ({ valor, nombre }))}
        autorizacion={{ version: estado.texto.version, texto: estado.texto.texto, demostracion: estado.texto.demostracion }}
      />
    </Contenedor>
  );
}
