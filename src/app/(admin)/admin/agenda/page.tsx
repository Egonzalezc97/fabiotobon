import type { Metadata } from "next";
import Link from "next/link";
import { requerirPanel } from "@/lib/auth/servidor";
import { db } from "@/lib/db";
import { listarBloqueos } from "@/modules/agenda/bloqueos";
import { listarCitasAgenda } from "@/modules/agenda/consultas";
import { leerHorarioMinutos } from "@/modules/agenda/horario";
import {
  diasEntre,
  esFechaLocal,
  fechaLocal,
  instante,
  lunesDeLaSemana,
  mesDe,
  minutosDelDia,
  nombreMes,
  semanasDelMes,
  sumarDias,
  sumarMeses,
} from "@/modules/agenda/tiempo";
import { rangoVisible, resumenPorDia } from "@/modules/agenda/vista";
import { leerParametros } from "@/modules/configuracion";
import { EnlaceBoton } from "@/components/panel/ui";
import { ListaDia } from "./lista-dia";
import { CuadriculaMes } from "./cuadricula-mes";
import { CuadriculaSemana } from "./cuadricula-semana";
import { PuntosMes } from "./puntos-mes";

export const metadata: Metadata = { title: "Agenda" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const MES = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "long" });

export default async function Agenda({ searchParams }: Props) {
  await requerirPanel();
  const sp = await searchParams;
  const hoy = fechaLocal(new Date());
  const fecha = typeof sp.fecha === "string" && esFechaLocal(sp.fecha) ? sp.fecha : hoy;
  // Por defecto: semana en escritorio; en celular esa misma URL muestra el día.
  const vista = sp.vista === "dia" ? "dia" : sp.vista === "mes" ? "mes" : "semana";
  const lunes = lunesDeLaSemana(fecha);
  const semana = diasEntre(lunes, sumarDias(lunes, 6));
  const mes = mesDe(fecha);
  const semanasMes = semanasDelMes(mes);
  const primerDiaVisible = vista === "mes" ? (semanasMes[0]?.[0] ?? lunes) : lunes;
  const ultimoDiaVisible = vista === "mes" ? (semanasMes.at(-1)?.[6] ?? sumarDias(lunes, 6)) : sumarDias(lunes, 6);
  const rango = { inicio: instante(primerDiaVisible), fin: instante(sumarDias(ultimoDiaVisible, 1)) };

  const [citas, bloqueos, horario, parametros] = await Promise.all([
    listarCitasAgenda(db(), rango),
    listarBloqueos(db(), rango),
    leerHorarioMinutos(db()),
    leerParametros(db()),
  ]);

  // Domingo y sábado solo aparecen si tienen horario o citas.
  const dias = semana.filter((d, i) => {
    if (i < 5) return true;
    const tieneHorario = (horario[i + 1] ?? []).length > 0;
    return tieneHorario || citas.some((c) => fechaLocal(c.inicio) === d);
  });
  const visible = rangoVisible(
    horario,
    citas.map((c) => ({ inicioMin: minutosDelDia(c.inicio), finMin: Math.min(24 * 60, minutosDelDia(c.inicio) + (c.fin.getTime() - c.inicio.getTime()) / 60_000) })),
  );

  const enlace = (f: string, v: string = vista) => `/admin/agenda?fecha=${f}${v === "semana" ? "" : `&vista=${v}`}`;
  const anterior = vista === "mes" ? `${sumarMeses(mes, -1)}-01` : sumarDias(fecha, vista === "dia" ? -1 : -7);
  const siguiente = vista === "mes" ? `${sumarMeses(mes, 1)}-01` : sumarDias(fecha, vista === "dia" ? 1 : 7);
  const resumen = vista === "mes" ? resumenPorDia(semanasMes.flat(), citas, bloqueos) : null;

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={enlace(anterior)} aria-label="Anterior" className="grid size-11 place-items-center rounded-[2px] border border-gris-200 bg-white hover:border-gris-800">
            ←
          </Link>
          <Link href={enlace(hoy)} className="inline-flex min-h-11 items-center rounded-[2px] border border-gris-200 bg-white px-3 font-sans text-sm hover:border-gris-800">
            Hoy
          </Link>
          <Link href={enlace(siguiente)} aria-label="Siguiente" className="grid size-11 place-items-center rounded-[2px] border border-gris-200 bg-white hover:border-gris-800">
            →
          </Link>
          <h1 className="ml-2 font-sans text-lg md:text-xl">
            {vista === "mes" ? (
              <span className="inline-block first-letter:uppercase">{nombreMes(mes)}</span>
            ) : vista === "dia" ? (
              <span className="inline-block first-letter:uppercase">
                {new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", weekday: "long", day: "numeric", month: "long" }).format(instante(fecha, 720))}
              </span>
            ) : (
              <>
                <span className="inline-block first-letter:uppercase lg:hidden">
                  {new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", weekday: "long", day: "numeric", month: "long" }).format(instante(fecha, 720))}
                </span>
                <span className="hidden lg:inline">
                  Semana del {MES.format(instante(lunes, 720))} al {MES.format(instante(sumarDias(lunes, 6), 720))}
                </span>
              </>
            )}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-[2px] border border-gris-200 bg-white font-sans text-sm">
            <Link href={enlace(fecha, "mes")} className={`px-3 py-2.5 ${vista === "mes" ? "bg-gris-800 text-white" : ""}`}>
              Mes
            </Link>
            <Link href={enlace(fecha, "semana")} className={`hidden px-3 py-2.5 lg:block ${vista === "semana" ? "bg-gris-800 text-white" : ""}`}>
              Semana
            </Link>
            <Link
              href={enlace(fecha, "dia")}
              className={`px-3 py-2.5 ${vista === "dia" ? "bg-gris-800 text-white" : vista === "semana" ? "bg-gris-800 text-white lg:bg-transparent lg:text-gris-800" : ""}`}
            >
              Día
            </Link>
          </div>
          <EnlaceBoton href={`/admin/agenda/nueva?fecha=${fecha}`}>Nueva cita</EnlaceBoton>
        </div>
      </div>

      {/* Mes: cuadrícula con etiquetas en escritorio; en celular, puntos por día y la lista del día elegido. */}
      {vista === "mes" && resumen && (
        <>
          <div className="hidden lg:block">
            <CuadriculaMes mes={mes} semanas={semanasMes} hoy={hoy} resumen={resumen} />
          </div>
          <div className="grid gap-4 lg:hidden">
            <PuntosMes mes={mes} semanas={semanasMes} hoy={hoy} seleccionado={fecha} resumen={resumen} />
            <h2 className="font-sans text-sm uppercase tracking-[0.14em] text-gris-600">
              <span className="inline-block first-letter:uppercase">
                {new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", weekday: "long", day: "numeric", month: "long" }).format(instante(fecha, 720))}
              </span>
            </h2>
            <ListaDia fecha={fecha} horario={horario} citas={citas} bloqueos={bloqueos} />
          </div>
        </>
      )}

      {/* Semana y día: en celular siempre la lista del día; en escritorio, semana o día según la vista. */}
      {vista !== "mes" && (
        <div className={vista === "semana" ? "lg:hidden" : ""}>
          <ListaDia fecha={fecha} horario={horario} citas={citas} bloqueos={bloqueos} />
        </div>
      )}
      {vista === "semana" && (
        <div className="hidden lg:block">
          <CuadriculaSemana
            dias={dias}
            hoy={hoy}
            horario={horario}
            citas={citas}
            bloqueos={bloqueos}
            desde={visible.desde}
            hasta={visible.hasta}
            granularidadMin={Math.max(15, parametros.granularidadMin)}
          />
        </div>
      )}
      <Leyenda />
    </div>
  );
}

function Leyenda() {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-2 font-sans text-xs text-gris-600">
      <li className="flex items-center gap-2"><span className="h-3 w-3 border-l-4 border-azul bg-white" /> Confirmada</li>
      <li className="flex items-center gap-2"><span className="h-3 w-3 border border-dashed border-gris-600 bg-white" /> Pendiente</li>
      <li className="flex items-center gap-2"><span className="h-3 w-3 bg-gris-200" /> Cumplida o no asistió</li>
      <li className="flex items-center gap-2"><span className="patron-bloqueo h-3 w-3" /> Bloqueo</li>
      <li className="flex items-center gap-2"><span className="h-3 w-3 bg-gris-100" /> Fuera de horario</li>
    </ul>
  );
}
