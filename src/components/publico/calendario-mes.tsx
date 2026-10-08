"use client";

import Link from "next/link";
import { useRef, type KeyboardEvent } from "react";

export type DiaCalendario = {
  fecha: string;
  numero: number;
  delMes: boolean;
  /** Tiene cupos y se puede elegir. */
  href: string | null;
  /** "jueves 8 de octubre, con horarios disponibles" para lectores de pantalla. */
  etiqueta: string;
};

type Props = {
  titulo: string;
  semanas: DiaCalendario[][];
  seleccionado: string | null;
  hoy: string;
  anterior: string | null;
  siguiente: string | null;
};

const DIAS = [
  ["L", "lunes"],
  ["M", "martes"],
  ["M", "miércoles"],
  ["J", "jueves"],
  ["V", "viernes"],
  ["S", "sábado"],
  ["D", "domingo"],
] as const;

/**
 * Cuadrícula de mes (lunes a domingo). Patrón de cuadrícula accesible: un solo día está en el orden de
 * tabulación y las flechas mueven el foco (Inicio/Fin: principio y fin de la semana). Enter abre el día.
 */
export function CalendarioMes({ titulo, semanas, seleccionado, hoy, anterior, siguiente }: Props) {
  const celdas = useRef<(HTMLElement | null)[]>([]);
  const planos = semanas.flat();
  // Único día en el orden de tabulación: el elegido; si no hay, el primero con cupos; si no, el primero del mes.
  const elegidoIdx = planos.findIndex((d) => d.fecha === seleccionado && d.href);
  const disponibleIdx = planos.findIndex((d) => d.href);
  const enfocable = elegidoIdx >= 0 ? elegidoIdx : disponibleIdx >= 0 ? disponibleIdx : Math.max(0, planos.findIndex((d) => d.delMes));

  function alPresionar(evento: KeyboardEvent<HTMLDivElement>) {
    const actual = celdas.current.findIndex((c) => c === document.activeElement);
    if (actual < 0) return;
    const fila = Math.floor(actual / 7) * 7;
    const destino = {
      ArrowLeft: actual - 1,
      ArrowRight: actual + 1,
      ArrowUp: actual - 7,
      ArrowDown: actual + 7,
      Home: fila,
      End: fila + 6,
    }[evento.key];
    if (destino === undefined) return;
    evento.preventDefault();
    celdas.current[Math.min(planos.length - 1, Math.max(0, destino))]?.focus();
  }

  const flecha = "grid size-11 place-items-center rounded-[2px] border font-sans";
  return (
    <div className="w-full max-w-md">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id="titulo-calendario" className="font-sans text-lg first-letter:uppercase">
          {titulo}
        </h2>
        <div className="flex gap-2">
          {anterior ? (
            <Link href={anterior} scroll={false} aria-label="Mes anterior" className={`${flecha} border-gris-200 hover:border-gris-800`}>
              ←
            </Link>
          ) : (
            <span aria-hidden="true" className={`${flecha} border-transparent text-gris-200`}>
              ←
            </span>
          )}
          {siguiente ? (
            <Link href={siguiente} scroll={false} aria-label="Mes siguiente" className={`${flecha} border-gris-200 hover:border-gris-800`}>
              →
            </Link>
          ) : (
            <span aria-hidden="true" className={`${flecha} border-transparent text-gris-200`}>
              →
            </span>
          )}
        </div>
      </div>

      <div role="grid" aria-labelledby="titulo-calendario" onKeyDown={alPresionar} className="font-sans">
        <div role="row" className="grid grid-cols-7 gap-1 pb-1">
          {DIAS.map(([corto, largo]) => (
            <span key={largo} role="columnheader" aria-label={largo} className="text-center text-xs uppercase tracking-[0.14em] text-gris-600">
              {corto}
            </span>
          ))}
        </div>
        {semanas.map((semana, s) => (
          <div key={semana[0]?.fecha} role="row" className="grid grid-cols-7 gap-1 pb-1">
            {semana.map((d, i) => {
              const indice = s * 7 + i;
              const elegido = d.fecha === seleccionado;
              const comun = `relative grid h-11 place-items-center rounded-[2px] text-[0.9375rem] tabular-nums outline-offset-2 sm:h-12 ${
                d.fecha === hoy ? "after:absolute after:bottom-1.5 after:h-0.5 after:w-3 after:bg-current" : ""
              }`;
              const ref = (el: HTMLElement | null) => {
                celdas.current[indice] = el;
              };
              return (
                <span key={d.fecha} role="gridcell" aria-selected={elegido || undefined}>
                  {d.href ? (
                    <Link
                      ref={ref}
                      href={d.href}
                      scroll={false}
                      tabIndex={indice === enfocable ? 0 : -1}
                      aria-label={d.etiqueta}
                      aria-current={elegido ? "date" : undefined}
                      className={`${comun} ${
                        elegido
                          ? "bg-gris-800 text-white"
                          : "border border-gris-200 font-medium text-gris-800 transition-colors duration-150 hover:border-azul hover:text-azul"
                      }`}
                    >
                      {d.numero}
                    </Link>
                  ) : (
                    <span
                      ref={ref}
                      tabIndex={indice === enfocable ? 0 : -1}
                      aria-disabled="true"
                      aria-label={d.etiqueta}
                      className={`${comun} ${d.delMes ? "text-gris-400" : "text-gris-200"}`}
                    >
                      {d.numero}
                    </span>
                  )}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
