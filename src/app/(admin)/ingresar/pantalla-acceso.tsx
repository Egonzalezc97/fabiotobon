import Link from "next/link";
import { Logo } from "@/components/marca";

/**
 * Composición común de las pantallas de acceso al panel (ingresar, código, cambiar contraseña).
 * Escritorio: bloque grafito con el logo (5 de 12 columnas) y el formulario a la derecha.
 * Celular: logo arriba en gris oscuro y el formulario debajo.
 */
export function PantallaAcceso({ children, ancho = "angosto" }: { children: React.ReactNode; ancho?: "angosto" | "amplio" }) {
  return (
    <div className="min-h-dvh bg-white font-sans md:grid md:grid-cols-12">
      <aside className="hidden bg-grafito text-white md:col-span-5 md:flex md:flex-col md:items-center md:justify-center md:px-8">
        <Logo nombre="logo-completo" etiqueta="Doctor Fabio Tobón Casas" className="h-52 lg:h-64" />
        <p className="mt-8 text-xs uppercase tracking-[0.3em] text-gris-200">Panel del consultorio</p>
      </aside>

      <main className="flex min-h-dvh flex-col px-5 py-10 md:col-span-7 md:justify-center md:px-10 md:py-16">
        <div className={`mx-auto w-full ${ancho === "amplio" ? "max-w-md" : "max-w-sm"}`}>
          <Logo nombre="logo-completo" etiqueta="Doctor Fabio Tobón Casas" className="mx-auto mb-10 h-28 w-fit text-gris-800 md:hidden" />
          {children}
          <Link href="/" className="mt-10 inline-block text-sm text-gris-600 underline underline-offset-4 hover:text-gris-800">
            Volver al sitio
          </Link>
        </div>
      </main>
    </div>
  );
}
