type Tono = "claro" | "medio" | "oscuro";

const TONOS: Record<Tono, string> = {
  claro: "bg-gris-100 text-gris-600",
  medio: "bg-gris-200 text-gris-600",
  oscuro: "bg-gris-400 text-gris-100",
};

/**
 * Lugar de una fotografía que aún no existe: bloque de color con la proporción definitiva.
 * Cuando llegue la foto se reemplaza por la imagen con la misma proporción, sin mover la composición.
 */
export function BloqueImagen({
  proporcion,
  leyenda,
  tono = "claro",
  leyendaALaDerecha = false,
  className,
}: {
  /** Ancho / alto, p. ej. "4 / 5". */
  proporcion: string;
  leyenda: string;
  tono?: Tono;
  leyendaALaDerecha?: boolean;
  className?: string;
}) {
  return (
    <div
      role="img"
      aria-label={leyenda}
      style={{ aspectRatio: proporcion }}
      className={`relative w-full ${TONOS[tono]} ${className ?? ""}`}
    >
      <span className={`absolute bottom-3 ${leyendaALaDerecha ? "right-3" : "left-3"} font-sans text-[0.6875rem] uppercase tracking-[0.18em]`}>
        {leyenda}
      </span>
    </div>
  );
}
