import { Logo } from "@/components/marca";
import { hayRedes, hayUbicacion, Redes, Ubicacion } from "@/components/publico/contacto";
import { marcadoresVisibles, Pendiente } from "@/components/publico/pendiente";
import type { ContactoPublico } from "@/modules/configuracion";

export function Pie({ contacto }: { contacto: ContactoPublico }) {
  return (
    <footer className="border-t border-gris-200 bg-papel">
      <div className="mx-auto grid max-w-[84rem] gap-10 px-5 pb-28 pt-14 md:px-10 lg:grid-cols-12 lg:gap-x-6">
        <Logo nombre="logo-completo" etiqueta="Doctor Fabio Tobón Casas" className="h-36 text-gris-800 lg:col-span-4" />
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
          {/* Obligatoria antes de producción (Ley 1581 de 2012); mientras falte, solo el marcador fuera de producción. */}
          {marcadoresVisibles() && (
            <p>
              Tratamiento de datos personales
              <br />
              <span className="text-gris-800">
                <Pendiente dato="política de tratamiento de datos" />
              </span>
            </p>
          )}
          <p className="sm:col-span-2">© {new Date().getFullYear()} Fabio Tobón Odontología</p>
        </div>
      </div>
    </footer>
  );
}
