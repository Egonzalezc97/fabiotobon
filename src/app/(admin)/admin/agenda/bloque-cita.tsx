import Link from "next/link";
import type { CitaAgenda } from "@/modules/agenda/consultas";
import { NOMBRES_ESTADO, type EstadoCita } from "@/modules/agenda/estados";
import { horaLocal } from "@/modules/agenda/tiempo";

export function estiloCita(estado: string): string {
  switch (estado) {
    case "confirmada":
      return "border-l-4 border-azul bg-white";
    case "pendiente":
      return "border border-dashed border-gris-600 bg-white";
    default:
      return "bg-gris-200 text-gris-600";
  }
}

/** Marcas de lo que Fabio aún no ha abierto: cita web nueva o marcada para revisión. */
export function MarcasCita({ cita }: { cita: CitaAgenda }) {
  if (cita.vista_en) return null;
  if (cita.revision) return <span className="bg-red-700 px-1 text-[0.625rem] uppercase tracking-[0.08em] text-white">Revisar</span>;
  if (cita.origen === "web") return <span className="bg-azul px-1 text-[0.625rem] uppercase tracking-[0.08em] text-white">Nueva</span>;
  return null;
}

/** La cita abre su detalle. Sin prefetch: abrir el detalle la marca como vista. */
export function EnlaceCita({
  cita,
  className,
  style,
  children,
}: {
  cita: CitaAgenda;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <Link href={`/admin/citas/${cita.id}`} prefetch={false} className={className} style={style}>
      {children}
    </Link>
  );
}

export function textoEstado(estado: string) {
  return NOMBRES_ESTADO[estado as EstadoCita] ?? estado;
}

export function rangoHoras(inicio: Date, fin: Date) {
  return `${horaLocal(inicio)}–${horaLocal(fin)}`;
}
