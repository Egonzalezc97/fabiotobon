import Link from "next/link";
import { Logo } from "@/components/marca";
import { BotonAgendar } from "@/components/publico/enlaces";

const NAVEGACION = [
  { href: "/#servicios", texto: "Servicios" },
  { href: "/#antes-y-despues", texto: "Antes y después" },
  { href: "/#contacto", texto: "Contacto" },
];

export function Cabecera() {
  return (
    <header className="mx-auto flex max-w-[84rem] items-center justify-between gap-6 px-5 py-5 md:px-10 md:py-7">
      <Link href="/" className="flex h-10 items-center gap-3 text-gris-800 md:h-12 xl:h-14" aria-label="Fabio Tobón Odontología, inicio">
        <Logo nombre="isotipo" className="h-full" />
        <Logo nombre="wordmark" className="h-full" />
      </Link>
      <nav aria-label="Principal" className="flex items-center gap-8">
        <ul className="hidden items-center gap-8 font-sans text-[0.9375rem] text-gris-600 lg:flex">
          {NAVEGACION.map((n) => (
            <li key={n.href}>
              <a href={n.href} className="transition-colors duration-150 hover:text-gris-800">
                {n.texto}
              </a>
            </li>
          ))}
        </ul>
        <BotonAgendar className="px-4 py-2.5 text-sm">Agendar</BotonAgendar>
      </nav>
    </header>
  );
}
