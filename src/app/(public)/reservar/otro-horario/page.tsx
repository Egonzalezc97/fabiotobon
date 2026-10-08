import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { ultimoDiaReservable } from "@/modules/agenda/disponibilidad";
import { cuposPublicos, obtenerSolicitud } from "@/modules/agenda/reserva-publica";
import { diasEntre, esFechaLocal, fechaLocal, formatearFechaLarga } from "@/modules/agenda/tiempo";
import { leerParametros } from "@/modules/configuracion";
import { Aviso, agruparPorDia, Contenedor, Encabezado, SelectorDias } from "../_ui";
import { db, leerTokenReserva } from "../comun";
import { FormularioOtroHorario } from "./formulario-otro-horario";

export const metadata: Metadata = { title: "Elige otro horario · Agendar valoración" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

// Tras verificar el código, el horario elegido se ocupó: se elige otro sin pedir un código nuevo.
export default async function OtroHorario({ searchParams }: Props) {
  await connection();
  const sp = await searchParams;
  const solicitud = await obtenerSolicitud(db(), await leerTokenReserva(), new Date());
  if (!solicitud) redirect("/reservar?aviso=vencida");
  if (solicitud.estado === "pendiente_codigo") redirect("/reservar/codigo");
  if (solicitud.estado === "completada") redirect("/reservar/listo");

  const ahora = new Date();
  const { horizonteDias } = await leerParametros(db());
  const porDia = agruparPorDia(await cuposPublicos(db(), { duracionMin: solicitud.servicioDuracionMin }, ahora));
  const pedida = typeof sp.fecha === "string" && esFechaLocal(sp.fecha) && porDia.has(sp.fecha) ? sp.fecha : null;
  const fecha = pedida ?? (porDia.has(fechaLocal(solicitud.inicio)) ? fechaLocal(solicitud.inicio) : [...porDia.keys()][0]) ?? null;
  const cupos = fecha ? (porDia.get(fecha) ?? []) : [];

  return (
    <Contenedor>
      <Encabezado titulo="Elige otro horario.">
        Tu celular ya quedó verificado, pero el horario que elegiste se ocupó mientras completabas tus datos.
      </Encabezado>
      <Aviso>Tienes 15 minutos para elegir otro horario sin pedir un código nuevo.</Aviso>
      <div className="mt-10">
        <SelectorDias
          dias={diasEntre(fechaLocal(ahora), ultimoDiaReservable(ahora, horizonteDias))}
          conCupos={new Set(porDia.keys())}
          seleccionado={fecha}
          enlace={(f) => `/reservar/otro-horario?fecha=${f}`}
        />
      </div>
      {fecha && cupos[0] && (
        <h2 className="mt-8 font-sans text-sm uppercase tracking-[0.2em] text-gris-600 first-letter:uppercase">
          {formatearFechaLarga(cupos[0])}
        </h2>
      )}
      <FormularioOtroHorario cupos={cupos.map((c) => c.toISOString())} />
    </Contenedor>
  );
}
