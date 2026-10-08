import { usuarioDeRed, type ContactoPublico, type UrgenciasPublicas } from "@/modules/configuracion";
import { IconoFacebook, IconoInstagram, IconoTelefono } from "./iconos";
import { marcadoresVisibles, TextoOPendiente } from "./pendiente";

const NUEVA_PESTANA = { target: "_blank", rel: "noopener noreferrer" } as const;

/** ¿Hay algo que mostrar de la ubicación? Sin dirección, solo el marcador (fuera de producción). */
export function hayUbicacion(contacto: ContactoPublico): boolean {
  return Boolean(contacto.direccion) || marcadoresVisibles();
}

/** Dirección, ciudad, referencia y enlace "Cómo llegar" (Google Maps, pestaña nueva). Sin mapa incrustado. */
export function Ubicacion({ contacto, compacta = false, className }: { contacto: ContactoPublico; compacta?: boolean; className?: string }) {
  const secundario = compacta ? "text-sm" : "text-[0.9375rem]";
  if (!hayUbicacion(contacto)) return null;
  return (
    <div className={className}>
      <p>
        <TextoOPendiente texto={contacto.direccion} dato="dirección" />
        <br />
        <TextoOPendiente texto={contacto.ciudad} dato="ciudad" />
      </p>
      {contacto.referencia && <p className={`mt-1 font-sans leading-snug text-gris-600 ${secundario}`}>{contacto.referencia}</p>}
      {contacto.enlaceComoLlegar && (
        <a
          href={contacto.enlaceComoLlegar}
          {...NUEVA_PESTANA}
          className={`mt-1 inline-flex min-h-11 items-center gap-1.5 font-sans text-gris-800 underline decoration-1 underline-offset-[6px] hover:decoration-2 ${secundario}`}
        >
          Cómo llegar
          <span aria-hidden="true">↗</span>
          <span className="sr-only">(se abre en una pestaña nueva)</span>
        </a>
      )}
    </div>
  );
}

export function hayRedes(contacto: ContactoPublico): boolean {
  return Boolean(contacto.instagram || contacto.facebook);
}

/** Un enlace por red: ícono y usuario (tomado de la URL), en el gris del sitio. Lo que no esté configurado no se muestra. */
export function Redes({ contacto, compacta = false, className }: { contacto: ContactoPublico; compacta?: boolean; className?: string }) {
  const redes = [
    { url: contacto.instagram, etiqueta: "Instagram de Fabio Tobón", Icono: IconoInstagram },
    { url: contacto.facebook, etiqueta: "Facebook de Fabio Tobón", Icono: IconoFacebook },
  ].filter((r): r is typeof r & { url: string } => Boolean(r.url));
  if (redes.length === 0) return null;
  return (
    <ul className={className}>
      {redes.map(({ url, etiqueta, Icono }) => (
        <li key={url}>
          <a
            href={url}
            {...NUEVA_PESTANA}
            aria-label={etiqueta}
            className={`inline-flex min-h-11 items-center gap-2.5 font-sans text-gris-600 transition-colors duration-150 hover:text-gris-800 ${compacta ? "text-sm" : "text-[0.9375rem]"}`}
          >
            <Icono className="size-5 shrink-0" />
            <span>{usuarioDeRed(url)}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

/** Franja grafito de urgencias. Sin animación ni colores de alarma; en celular el botón ocupa todo el ancho. */
export function FranjaUrgencias({ urgencias, className }: { urgencias: UrgenciasPublicas; className?: string }) {
  return (
    <aside aria-label={urgencias.texto} className={`bg-grafito text-white ${className ?? ""}`}>
      <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6 md:px-7">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-sans">
          <IconoTelefono className="size-5 shrink-0 text-gris-400" />
          <span className="text-sm uppercase tracking-[0.2em]">{urgencias.texto}</span>
          <span className="basis-full pl-8 text-[0.9375rem] tabular-nums text-gris-400 sm:basis-auto sm:pl-0">{urgencias.telefono}</span>
        </p>
        <a
          href={urgencias.enlace}
          className="inline-flex min-h-12 w-full shrink-0 items-center justify-center rounded-[2px] bg-white px-6 font-sans text-base font-medium text-grafito transition-colors duration-150 hover:bg-gris-100 sm:w-auto"
        >
          Llamar ahora<span className="sr-only">, {urgencias.telefono}</span>
        </a>
      </div>
    </aside>
  );
}
