/** Marcador visible de un dato que Fabio aún no ha entregado. */
export function Pendiente({ dato, className }: { dato: string; className?: string }) {
  return (
    <span
      className={`inline-block border border-dashed border-current px-1.5 font-sans text-[0.8em] tracking-wide opacity-80 ${className ?? ""}`}
    >
      [PENDIENTE: {dato}]
    </span>
  );
}

/** Muestra el texto si existe; si no, el marcador de pendiente. */
export function TextoOPendiente({ texto, dato }: { texto: string | null; dato: string }) {
  return texto ? <>{texto}</> : <Pendiente dato={dato} />;
}
