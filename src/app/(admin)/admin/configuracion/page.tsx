import type { Metadata } from "next";
import { requerirAdmin } from "@/lib/auth/servidor";
import { db } from "@/lib/db";
import { leerParametros, leerTextoAutorizacion } from "@/modules/configuracion";
import { Alerta, Titulo } from "@/components/panel/ui";
import { FormularioConfiguracion } from "./formulario-configuracion";

export const metadata: Metadata = { title: "Configuración" };

export default async function Configuracion() {
  await requerirAdmin();
  const [parametros, texto] = await Promise.all([leerParametros(db()), leerTextoAutorizacion(db())]);
  return (
    <div className="grid max-w-2xl gap-6">
      <Titulo>Configuración</Titulo>
      <FormularioConfiguracion parametros={parametros} />
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
