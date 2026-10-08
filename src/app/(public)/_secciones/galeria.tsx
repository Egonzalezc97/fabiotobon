"use client";

import { useState } from "react";
import { BloqueImagen } from "@/components/publico/bloque-imagen";
import { Comparador } from "@/components/publico/comparador";
import type { CasoAntesDespues, ImagenSitio } from "@/content";

/** Foto publicada: AVIF con WebP de respaldo, en el ancho que pida la pantalla. */
function Foto({ imagen, alt }: { imagen: ImagenSitio; alt: string }) {
  const tamanos = "(min-width: 1024px) 60vw, 100vw";
  const mayor = imagen.webp.split(", ").at(-1)?.split(" ")[0];
  return (
    <picture className="block">
      <source type="image/avif" srcSet={imagen.avif} sizes={tamanos} />
      <source type="image/webp" srcSet={imagen.webp} sizes={tamanos} />
      {/* Versiones ya optimizadas al publicar; next/image las procesaría otra vez. */}
      <img src={mayor} alt={alt} width={imagen.ancho} height={imagen.alto} loading="lazy" decoding="async" draggable={false} className="h-full w-full object-cover" />
    </picture>
  );
}

export function Galeria({ casos }: { casos: CasoAntesDespues[] }) {
  const [activo, setActivo] = useState(0);
  const caso = casos[activo];
  if (!caso) return null;

  return (
    <div className="grid gap-8 lg:grid-cols-12 lg:gap-6">
      <div className="lg:order-2 lg:col-span-8">
        <Comparador
          key={caso.id}
          proporcion="3 / 2"
          etiqueta={`Comparar antes y después: ${caso.procedimiento}`}
          antes={
            caso.imagenes ? (
              <Foto imagen={caso.imagenes.antes} alt={`Antes: ${caso.procedimiento}`} />
            ) : (
              <BloqueImagen proporcion="3 / 2" tono="oscuro" leyenda="Imagen pendiente" />
            )
          }
          despues={
            caso.imagenes ? (
              <Foto imagen={caso.imagenes.despues} alt={`Después: ${caso.procedimiento}`} />
            ) : (
              <BloqueImagen proporcion="3 / 2" tono="medio" leyenda="Imagen pendiente" leyendaALaDerecha />
            )
          }
        />
      </div>

      <div className="lg:order-1 lg:col-span-4 lg:flex lg:flex-col lg:justify-end">
        <ul className="divide-y divide-white/15 border-y border-white/15" aria-label="Casos">
          {casos.map((c, i) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setActivo(i)}
                aria-pressed={i === activo}
                className={`flex w-full items-baseline justify-between gap-4 py-4 text-left font-sans text-lg transition-colors duration-150 ${
                  i === activo ? "text-white" : "text-gris-400 hover:text-gris-100"
                }`}
              >
                <span>{c.procedimiento}</span>
                <span aria-hidden="true" className="text-sm tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
              </button>
            </li>
          ))}
        </ul>
        {caso.descripcion && <p className="mt-6 font-serif text-gris-200">{caso.descripcion}</p>}
      </div>
    </div>
  );
}
