import Link from "next/link";
import { enlaceWhatsapp } from "@/lib/sitio";
import { Pendiente } from "./pendiente";

export function BotonAgendar({ className, children = "Agenda tu valoración" }: { className?: string; children?: React.ReactNode }) {
  return (
    <Link
      href="/reservar"
      className={`inline-flex items-center rounded-[2px] bg-azul px-6 py-3.5 font-sans text-[0.9375rem] font-medium text-white transition-colors duration-150 hover:bg-azul-fuerte ${className ?? ""}`}
    >
      {children}
    </Link>
  );
}

/** Enlace de texto a WhatsApp. Sin número configurado, muestra el marcador de pendiente. */
export function EnlaceWhatsapp({
  numero,
  className,
  children = "Escríbenos por WhatsApp",
}: {
  numero: string | null;
  className?: string;
  children?: React.ReactNode;
}) {
  if (!numero) {
    return (
      <span className={`font-sans text-[0.9375rem] ${className ?? ""}`}>
        WhatsApp <Pendiente dato="número de WhatsApp" />
      </span>
    );
  }
  return (
    <a
      href={enlaceWhatsapp(numero)}
      target="_blank"
      rel="noopener noreferrer"
      className={`group inline-flex items-center gap-2 font-sans text-[0.9375rem] underline decoration-1 underline-offset-[6px] transition-colors duration-150 hover:decoration-2 ${className ?? ""}`}
    >
      {children}
      <span aria-hidden="true" className="transition-transform duration-150 group-hover:translate-x-0.5">
        →
      </span>
    </a>
  );
}

/** Botón fijo de WhatsApp, visible en toda la experiencia pública. */
export function WhatsappFlotante({ numero }: { numero: string | null }) {
  const clases =
    "fixed z-40 inline-flex items-center gap-2 rounded-[2px] bg-gris-800 px-4 py-3 font-sans text-sm font-medium text-white";
  const posicion = {
    right: "max(1rem, env(safe-area-inset-right))",
    bottom: "max(1rem, env(safe-area-inset-bottom))",
  };
  if (!numero) {
    return (
      <span className={`${clases} opacity-90`} style={posicion} title="[PENDIENTE: número de WhatsApp]">
        WhatsApp <span className="text-[0.6875rem] uppercase tracking-[0.14em] text-gris-200">pendiente</span>
      </span>
    );
  }
  return (
    <a
      href={enlaceWhatsapp(numero)}
      target="_blank"
      rel="noopener noreferrer"
      className={`${clases} transition-colors duration-150 hover:bg-grafito`}
      style={posicion}
    >
      WhatsApp
    </a>
  );
}
