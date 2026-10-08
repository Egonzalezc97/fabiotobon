import type { Metadata } from "next";
import { requerirAdmin } from "@/lib/auth/servidor";
import { BotonCerrarSesion } from "../boton-cerrar-sesion";

export const metadata: Metadata = {
  title: "Panel",
  robots: { index: false, follow: false },
};

export default async function LayoutAdmin({ children }: { children: React.ReactNode }) {
  // La autorización se decide aquí, en el servidor, en cada petición.
  const admin = await requerirAdmin();

  return (
    <div className="min-h-dvh bg-superficie">
      <header className="flex items-center justify-between border-b border-linea bg-white px-6 py-4">
        <span className="text-sm font-medium">Panel</span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-tinta-suave">{admin.nombre}</span>
          <BotonCerrarSesion />
        </div>
      </header>
      <main className="px-6 py-10">{children}</main>
    </div>
  );
}
