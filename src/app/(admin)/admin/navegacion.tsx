"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Ocultar secciones es solo comodidad: la autorización real está en cada página y acción (requerirRol).
const SECCIONES: { href: string; texto: string; soloAdmin?: boolean }[] = [
  { href: "/admin", texto: "Inicio" },
  { href: "/admin/agenda", texto: "Agenda" },
  { href: "/admin/por-revisar", texto: "Por revisar" },
  { href: "/admin/pacientes", texto: "Pacientes" },
  { href: "/admin/bloqueos", texto: "Bloqueos" },
  { href: "/admin/galeria", texto: "Galería", soloAdmin: true },
  { href: "/admin/servicios", texto: "Servicios", soloAdmin: true },
  { href: "/admin/horario", texto: "Horario", soloAdmin: true },
  { href: "/admin/usuarios", texto: "Usuarios", soloAdmin: true },
  { href: "/admin/configuracion", texto: "Configuración", soloAdmin: true },
];

export function Navegacion({ webNuevas, enRevision, esAdmin }: { webNuevas: number; enRevision: number; esAdmin: boolean }) {
  const ruta = usePathname();
  return (
    <nav aria-label="Secciones del panel" className="mx-auto max-w-[96rem] overflow-x-auto px-4 md:px-6">
      <ul className="flex gap-1 font-sans text-sm">
        {SECCIONES.filter((s) => esAdmin || !s.soloAdmin).map((s) => {
          const activa = s.href === "/admin" ? ruta === "/admin" : ruta === s.href || ruta.startsWith(`${s.href}/`);
          const contador = s.href === "/admin/por-revisar" ? webNuevas + enRevision : 0;
          return (
            <li key={s.href}>
              <Link
                href={s.href}
                aria-current={activa ? "page" : undefined}
                className={`flex min-h-11 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 ${
                  activa ? "border-gris-800 text-gris-800" : "border-transparent text-gris-600 hover:text-gris-800"
                }`}
              >
                {s.texto}
                {contador > 0 && <span className="rounded-[2px] bg-azul px-1.5 text-xs tabular-nums text-white">{contador}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
