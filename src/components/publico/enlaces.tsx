import Link from "next/link";
import { marcadoresVisibles, Pendiente } from "./pendiente";

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

/**
 * Enlace de texto a WhatsApp dentro de la página (hero, servicios, contacto, reserva).
 * `enlace` es la URL wa.me completa con el mensaje inicial de configuración; sin número, marcador de pendiente
 * (en producción, nada).
 */
export function EnlaceWhatsapp({
  enlace,
  className,
  children = "Escríbenos por WhatsApp",
}: {
  enlace: string | null;
  className?: string;
  children?: React.ReactNode;
}) {
  if (!enlace) {
    if (!marcadoresVisibles()) return null;
    return (
      <span className={`font-sans text-[0.9375rem] ${className ?? ""}`}>
        WhatsApp <Pendiente dato="número de WhatsApp" />
      </span>
    );
  }
  return (
    <a
      href={enlace}
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

/** Logotipo oficial de WhatsApp (glifo), en blanco. */
function IconoWhatsapp({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={className} fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

/**
 * Botón fijo de WhatsApp, visible en toda la experiencia pública.
 * Excepción explícita a la dirección visual (CLAUDE.md): círculo verde de WhatsApp con sombra suave.
 * Sin contador ni globo de notificación: no se simulan mensajes sin leer.
 */
export function WhatsappFlotante({ enlace }: { enlace: string | null }) {
  const posicion = {
    right: "max(1rem, env(safe-area-inset-right, 0px))",
    bottom: "calc(1rem + env(safe-area-inset-bottom, 0px))",
  };
  const circulo =
    "fixed z-40 grid size-14 place-items-center rounded-full bg-[#25D366] text-white shadow-[0_4px_14px_rgba(0,0,0,0.18)]";

  if (!enlace) {
    if (!marcadoresVisibles()) return null;
    return (
      <span role="img" aria-label="WhatsApp: número pendiente" title="[PENDIENTE: número de WhatsApp]" className={`${circulo} opacity-60`} style={posicion}>
        <IconoWhatsapp className="size-7" />
      </span>
    );
  }
  return (
    <a
      href={enlace}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Escribir por WhatsApp"
      className={`group ${circulo} transition-transform duration-150 hover:scale-105 focus-visible:outline-offset-4`}
      style={posicion}
    >
      <IconoWhatsapp className="size-7" />
      {/* Solo en escritorio, al pasar el cursor o con foco de teclado. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-full top-1/2 mr-3 hidden -translate-y-1/2 whitespace-nowrap rounded-[2px] bg-white px-3 py-1.5 font-sans text-sm text-gris-800 opacity-0 shadow-[0_2px_8px_rgba(0,0,0,0.12)] transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 md:block"
      >
        ¿Dudas? Escríbenos
      </span>
    </a>
  );
}
