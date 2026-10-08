import type { Metadata } from "next";
import { requerirAdmin } from "@/lib/auth/servidor";
import { db } from "@/lib/db";
import { datosContacto, leerContacto, leerParametros, leerTextoAutorizacion } from "@/modules/configuracion";
import { Alerta, Titulo } from "@/components/panel/ui";
import { FormularioConfiguracion } from "./formulario-configuracion";
import { FormularioContacto } from "./formulario-contacto";

export const metadata: Metadata = { title: "Configuración" };

export default async function Configuracion() {
  await requerirAdmin();
  const [parametros, texto, contacto] = await Promise.all([leerParametros(db()), leerTextoAutorizacion(db()), leerContacto(db())]);
  return (
    <div className="grid max-w-2xl gap-6">
      <Titulo>Configuración</Titulo>
      <section className="grid gap-2">
        <h2 className="font-sans text-sm uppercase tracking-[0.14em] text-gris-600">Datos de contacto</h2>
        <FormularioContacto contacto={datosContacto(contacto)} />
      </section>
      <section className="grid gap-2">
        <h2 className="font-sans text-sm uppercase tracking-[0.14em] text-gris-600">Agenda y reserva</h2>
        <FormularioConfiguracion parametros={parametros} />
      </section>
      <section className="grid gap-2 font-sans">
        <h2 className="text-sm uppercase tracking-[0.14em] text-gris-600">Autorización de tratamiento de datos</h2>
        {!texto ? (
          <Alerta tono="error">No hay texto cargado. Sin él, la reserva web está desactivada.</Alerta>
        ) : texto.demostracion ? (
          <Alerta tono="error">
            El texto vigente ({texto.version}) es de DEMOSTRACIÓN. En producción la reserva web queda desactivada hasta cargar el texto real
            redactado con el abogado.
          </Alerta>
        ) : (
          <p className="text-sm text-gris-600">Versión vigente: {texto.version}.</p>
        )}
      </section>
    </div>
  );
}
