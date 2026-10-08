import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { ultimoDiaReservable } from "@/modules/agenda/disponibilidad";
import { cuposPublicos, obtenerSolicitud } from "@/modules/agenda/reserva-publica";
import { esFechaLocal, esMesLocal, fechaLocal, formatearFechaLarga, mesDe } from "@/modules/agenda/tiempo";
import { leerParametros } from "@/modules/configuracion";
import { CalendarioMes } from "@/components/publico/calendario-mes";
import { Aviso, agruparPorDia, armarCalendario, Contenedor, Encabezado } from "../_ui";
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
  const hoy = fechaLocal(ahora);
  const { horizonteDias } = await leerParametros(db());
  const ultimoMes = mesDe(ultimoDiaReservable(ahora, horizonteDias));
  const porDia = agruparPorDia(await cuposPublicos(db(), { duracionMin: solicitud.servicioDuracionMin }, ahora));
  const fechaPedida = typeof sp.fecha === "string" && esFechaLocal(sp.fecha) && porDia.has(sp.fecha) ? sp.fecha : null;
  const mesPedido = typeof sp.mes === "string" && esMesLocal(sp.mes) && sp.mes >= mesDe(hoy) && sp.mes <= ultimoMes ? sp.mes : null;
  const original = fechaLocal(solicitud.inicio);
  const mes = fechaPedida ? mesDe(fechaPedida) : (mesPedido ?? mesDe(porDia.has(original) ? original : ([...porDia.keys()][0] ?? hoy)));
  const fecha =
    fechaPedida ?? (mesDe(original) === mes && porDia.has(original) ? original : [...porDia.keys()].find((d) => mesDe(d) === mes)) ?? null;
  const cupos = fecha ? (porDia.get(fecha) ?? []) : [];
  const calendario = armarCalendario({
    mes,
    conCupos: new Set(porDia.keys()),
    seleccionado: fecha,
    hoy,
    primerMes: mesDe(hoy),
    ultimoMes,
    hrefDia: (d) => `/reservar/otro-horario?fecha=${d}`,
    hrefMes: (m) => `/reservar/otro-horario?mes=${m}`,
  });

  return (
    <Contenedor>
      <Encabezado titulo="Elige otro horario.">
        Tu celular ya quedó verificado, pero el horario que elegiste se ocupó mientras completabas tus datos.
      </Encabezado>
      <Aviso>Tienes 15 minutos para elegir otro horario sin pedir un código nuevo.</Aviso>
      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,28rem)_minmax(0,1fr)] lg:gap-16">
        <CalendarioMes {...calendario} />
        <div aria-live="polite">
          {fecha && cupos[0] ? (
            <h2 className="font-sans text-sm uppercase tracking-[0.2em] text-gris-600">
              <span className="inline-block first-letter:uppercase">{formatearFechaLarga(cupos[0])}</span>
            </h2>
          ) : (
            <p className="font-serif text-lg text-gris-600">No hay horarios libres este mes.</p>
          )}
          {cupos.length > 0 && <FormularioOtroHorario cupos={cupos.map((c) => c.toISOString())} />}
        </div>
      </div>
    </Contenedor>
  );
}
