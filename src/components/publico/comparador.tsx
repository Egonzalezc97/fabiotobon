"use client";

import { useId, useState } from "react";

/**
 * Comparador deslizable de antes y después. El control es un <input type="range"> que cubre toda
 * el área: funciona con mouse, toque y teclado (flechas, Inicio, Fin) sin JavaScript de arrastre propio.
 */
export function Comparador({
  antes,
  despues,
  proporcion,
  etiqueta,
}: {
  antes: React.ReactNode;
  despues: React.ReactNode;
  /** Ancho / alto, p. ej. "3 / 2". */
  proporcion: string;
  etiqueta: string;
}) {
  const [posicion, setPosicion] = useState(50);
  const id = useId();

  return (
    <div className="relative w-full select-none overflow-hidden outline-offset-4 has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-azul" style={{ aspectRatio: proporcion }}>
      <div className="absolute inset-0 [&>*]:h-full">{antes}</div>
      <div className="absolute inset-0 [&>*]:h-full" style={{ clipPath: `inset(0 0 0 ${posicion}%)` }}>
        {despues}
      </div>

      <span className="pointer-events-none absolute left-3 top-3 font-sans text-[0.6875rem] uppercase tracking-[0.2em] text-grafito">
        Antes
      </span>
      <span className="pointer-events-none absolute right-3 top-3 font-sans text-[0.6875rem] uppercase tracking-[0.2em] text-grafito">
        Después
      </span>

      {/* Línea divisoria y manija */}
      <div className="pointer-events-none absolute inset-y-0 w-px bg-white" style={{ left: `${posicion}%` }}>
        <div className="absolute left-1/2 top-1/2 flex h-10 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-[3px] rounded-[2px] bg-azul shadow-[0_1px_3px_rgba(0,0,0,0.25)]">
          <span className="h-4 w-px bg-white" />
          <span className="h-4 w-px bg-white" />
        </div>
      </div>

      <label htmlFor={id} className="sr-only">
        {etiqueta}
      </label>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        value={posicion}
        onChange={(e) => setPosicion(Number(e.target.value))}
        aria-valuetext={`${posicion} % antes, ${100 - posicion} % después`}
        className="absolute inset-0 h-full w-full cursor-ew-resize appearance-none bg-transparent opacity-0 [&::-webkit-slider-thumb]:h-full [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:appearance-none"
      />
    </div>
  );
}
