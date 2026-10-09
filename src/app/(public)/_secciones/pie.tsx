import Link from "next/link";
import { Logo } from "@/components/marca";
import { hayRedes, hayUbicacion, Redes, Ubicacion } from "@/components/publico/contacto";
import { RUTA_POLITICA } from "@/components/publico/rutas";
import type { ContactoPublico } from "@/modules/configuracion";

export function Pie({ contacto, politicaPublicada }: { contacto: ContactoPublico; politicaPublicada: boolean }) {
  return (
    <footer className="border-t border-gris-200 bg-papel">
      <div className="mx-auto grid max-w-[84rem] gap-10 px-5 pb-28 pt-14 md:px-10 lg:grid-cols-12 lg:gap-x-6">
        <div className="lg:col-span-4">
          <Logo nombre="logo-completo" etiqueta="Doctor Fabio Tobón Casas" className="h-36 text-gris-800" />
          {contacto.especialidad && (
            <p className="mt-4 font-sans text-sm uppercase tracking-[0.2em] text-gris-600">{contacto.especialidad}</p>
          )}
        </div>
        <div className="grid gap-6 self-end font-sans text-sm text-gris-600 sm:grid-cols-2 lg:col-span-7 lg:col-start-6">
          {hayUbicacion(contacto) && (
            <div>
              Consultorio
              <Ubicacion contacto={contacto} compacta className="text-gris-800" />
            </div>
          )}
          {/* Opcionales: si están vacíos no se muestran. */}
          {hayRedes(contacto) && (
            <div>
              Redes
              <Redes contacto={contacto} compacta />
            </div>
          )}
          {contacto.registroProfesional && (
            <p>
              Registro profesional
              <br />
              <span className="text-gris-800">{contacto.registroProfesional}</span>
            </p>
          )}
          {/* Solo con la política publicada: nunca un enlace a una página que en producción no existe. */}
          {politicaPublicada && (
            <p>
              <Link href={RUTA_POLITICA} className="text-gris-800 underline underline-offset-4 hover:decoration-2">
                Tratamiento de datos personales
              </Link>
            </p>
          )}
          <p className="sm:col-span-2">© {new Date().getFullYear()} Fabio Tobón Odontología</p>
        </div>
      </div>
    </footer>
  );
}
