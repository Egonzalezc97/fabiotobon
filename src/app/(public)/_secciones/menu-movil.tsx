"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

export type EnlaceNavegacion = { href: string; texto: string };

const ID_PANEL = "menu-movil";

/**
 * Menú de celular y tableta (bajo lg). Accesible: aria-expanded/aria-controls, cierre con Escape y al tocar
 * un enlace, foco atrapado entre el botón y el panel mientras está abierto, y el foco vuelve al botón al cerrar.
 * Mientras está abierto, la página no se desplaza y el botón flotante de WhatsApp se oculta (ver globals.css).
 */
export function MenuMovil({ enlaces }: { enlaces: EnlaceNavegacion[] }) {
  const [abierto, setAbierto] = useState(false);
  const boton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  const cerrar = useCallback((devolverFoco: boolean) => {
    setAbierto(false);
    if (devolverFoco) boton.current?.focus();
  }, []);

  useEffect(() => {
    if (!abierto) return;
    const { body } = document;
    body.dataset.menuAbierto = "true";
    body.style.overflow = "hidden";
    panel.current?.querySelector<HTMLElement>("a")?.focus();

    function alTeclear(evento: KeyboardEvent) {
      if (evento.key === "Escape") {
        evento.preventDefault();
        cerrar(true);
        return;
      }
      if (evento.key !== "Tab") return;
      const enfocables = [boton.current, ...(panel.current?.querySelectorAll<HTMLElement>("a") ?? [])].filter(
        (el): el is HTMLElement => Boolean(el),
      );
      const primero = enfocables[0];
      const ultimo = enfocables[enfocables.length - 1];
      const activo = document.activeElement as HTMLElement | null;
      const dentro = activo ? enfocables.includes(activo) : false;
      if (evento.shiftKey && (activo === primero || !dentro)) {
        evento.preventDefault();
        ultimo?.focus();
      } else if (!evento.shiftKey && (activo === ultimo || !dentro)) {
        evento.preventDefault();
        primero?.focus();
      }
    }
    // Si la pantalla crece hasta mostrar la navegación de escritorio, el menú se cierra solo.
    const escritorio = window.matchMedia("(min-width: 64rem)");
    const alCambiarAncho = () => escritorio.matches && cerrar(false);

    document.addEventListener("keydown", alTeclear);
    escritorio.addEventListener("change", alCambiarAncho);
    return () => {
      delete body.dataset.menuAbierto;
      body.style.overflow = "";
      document.removeEventListener("keydown", alTeclear);
      escritorio.removeEventListener("change", alCambiarAncho);
    };
  }, [abierto, cerrar]);

  return (
    <div className="lg:hidden">
      <button
        ref={boton}
        type="button"
        aria-expanded={abierto}
        aria-controls={ID_PANEL}
        aria-label={abierto ? "Cerrar menú" : "Abrir menú"}
        onClick={() => (abierto ? cerrar(false) : setAbierto(true))}
        className="-mr-2.5 grid size-11 place-items-center text-white"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.5">
          {abierto ? <path d="M5 5l14 14M19 5 5 19" /> : <path d="M3 7h18M3 12h18M3 17h18" />}
        </svg>
      </button>

      <div
        ref={panel}
        id={ID_PANEL}
        hidden={!abierto}
        className="fixed inset-x-0 bottom-0 top-[var(--alto-cabecera)] z-50 overflow-y-auto border-t border-gris-800 bg-grafito"
      >
        <nav aria-label="Menú" className="px-5 pb-10 pt-6 md:px-10">
          <ul>
            {enlaces.map((e) => (
              <li key={e.href} className="border-b border-gris-800">
                <a
                  href={e.href}
                  onClick={() => cerrar(false)}
                  className="flex min-h-16 items-center font-sans text-2xl font-light text-gris-100 hover:text-white"
                >
                  {e.texto}
                </a>
              </li>
            ))}
          </ul>
          <Link
            href="/reservar"
            onClick={() => cerrar(false)}
            className="mt-10 flex min-h-12 items-center justify-center rounded-[2px] bg-azul px-6 font-sans text-base font-medium text-white hover:bg-azul-fuerte"
          >
            Agenda tu valoración
          </Link>
        </nav>
      </div>
    </div>
  );
}

/**
 * Mide la cabecera fija (cinta de demostración + navbar) y deja su alto en --alto-cabecera:
 * lo usan el panel del menú y el scroll-margin de las secciones. globals.css trae un valor por defecto sin JS.
 */
export function MedirCabecera() {
  const marca = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const cabecera = marca.current?.closest<HTMLElement>("[data-cabecera]");
    if (!cabecera) return;
    const raiz = document.documentElement;
    const observador = new ResizeObserver(() => raiz.style.setProperty("--alto-cabecera", `${cabecera.offsetHeight}px`));
    observador.observe(cabecera);
    return () => {
      observador.disconnect();
      raiz.style.removeProperty("--alto-cabecera");
    };
  }, []);
  return <span ref={marca} hidden />;
}
