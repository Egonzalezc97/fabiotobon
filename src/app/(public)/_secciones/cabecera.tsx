import Link from "next/link";
import { Logo } from "@/components/marca";
import { BotonAgendar } from "@/components/publico/enlaces";
import { MenuMovil, type EnlaceNavegacion } from "./menu-movil";

const NAVEGACION: EnlaceNavegacion[] = [
  { href: "/#servicios", texto: "Servicios" },
  { href: "/#antes-y-despues", texto: "Antes y después" },
  { href: "/#contacto", texto: "Contacto" },
];

/**
 * Navbar fija sobre grafito, sin sombra: la separa un borde de 1 px. Los logos son currentColor y van en blanco.
 * Contraste: blanco ~18:1 y gris-200 ~12:1 sobre #161614 (AA pide 4,5:1).
 */
export function Cabecera() {
  return (
    <header className="sobre-oscuro border-b border-gris-800 bg-grafito">
      <div className="mx-auto flex h-16 max-w-[84rem] items-center justify-between gap-4 px-5 md:h-[4.75rem] md:px-10">
        <Link
          href="/"
          className="flex h-7 items-center gap-2 text-white min-[360px]:h-9 min-[360px]:gap-3 md:h-11"
          aria-label="Fabio Tobón Odontología, inicio"
        >
          <Logo nombre="isotipo" className="h-full" />
          <Logo nombre="wordmark" className="h-full" />
        </Link>
        <nav aria-label="Principal" className="flex items-center gap-4 lg:gap-8">
          <ul className="hidden items-center gap-8 font-sans text-[0.9375rem] text-gris-200 lg:flex">
            {NAVEGACION.map((n) => (
              <li key={n.href}>
                <a href={n.href} className="transition-colors duration-150 hover:text-white">
                  {n.texto}
                </a>
              </li>
            ))}
          </ul>
          <BotonAgendar className="px-4 py-2.5 text-sm">Agendar</BotonAgendar>
          <MenuMovil enlaces={NAVEGACION} />
        </nav>
      </div>
    </header>
  );
}
