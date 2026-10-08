import { readFileSync } from "node:fs";
import path from "node:path";

// Logos de public/brand incrustados en línea para que hereden el color del texto (fill="currentColor").
// Se quitan solo los metadatos de procedencia (C2PA) que no se dibujan; el trazo no se toca.

type NombreLogo = "isotipo" | "wordmark" | "logo-completo";

const cache = new Map<NombreLogo, string>();

function svg(nombre: NombreLogo): string {
  let contenido = cache.get(nombre);
  if (!contenido) {
    contenido = readFileSync(path.join(process.cwd(), "public/brand", `${nombre}.svg`), "utf8")
      .replace(/<metadata>[\s\S]*?<\/metadata>/g, "")
      .replace(/\s+xmlns:c2pa="[^"]*"/g, "")
      .replace("<svg ", '<svg aria-hidden="true" focusable="false" ');
    cache.set(nombre, contenido);
  }
  return contenido;
}

type Props = { nombre: NombreLogo; className?: string; etiqueta?: string };

export function Logo({ nombre, className, etiqueta }: Props) {
  return (
    <span
      className={`marca block ${className ?? ""}`}
      role={etiqueta ? "img" : undefined}
      aria-label={etiqueta}
      aria-hidden={etiqueta ? undefined : true}
      dangerouslySetInnerHTML={{ __html: svg(nombre) }}
    />
  );
}
