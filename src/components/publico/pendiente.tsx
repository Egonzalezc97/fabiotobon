import { contenidoDemoActivo, esProduccion } from "@/lib/despliegue";

/**
 * Los marcadores "[PENDIENTE: …]" solo se ven fuera de producción o con DEMO_CONTENT activo.
 * En producción, un dato que falta simplemente no se muestra.
 */
export function marcadoresVisibles(variables: Record<string, string | undefined> = process.env): boolean {
  return !esProduccion(variables) || contenidoDemoActivo(variables);
}

/** Marcador visible de un dato que Fabio aún no ha entregado. */
export function Pendiente({ dato, className }: { dato: string; className?: string }) {
  if (!marcadoresVisibles()) return null;
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
