import type { Metadata } from "next";
import { requerirAdmin } from "@/lib/auth/servidor";
import { db } from "@/lib/db";
import { RUTA_POLITICA } from "@/components/publico/rutas";
import { formatearFechaCorta, formatearHora } from "@/modules/agenda/tiempo";
import {
  datosContacto,
  leerContacto,
  leerParametros,
  leerPolitica,
  leerTextoAutorizacion,
  listarVersionesAutorizacion,
} from "@/modules/configuracion";
import { Alerta, Titulo } from "@/components/panel/ui";
import { FormularioConfiguracion } from "./formulario-configuracion";
import { FormularioContacto } from "./formulario-contacto";
import { FormularioAutorizacion, FormularioPolitica } from "./formularios-legales";

export const metadata: Metadata = { title: "Configuración" };

export default async function Configuracion() {
  await requerirAdmin();
  const [parametros, texto, contacto, versiones, politica] = await Promise.all([
    leerParametros(db()),
    leerTextoAutorizacion(db()),
    leerContacto(db()),
    listarVersionesAutorizacion(db()),
    leerPolitica(db()),
  ]);
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
        ) : texto.borrador ? (
          <Alerta tono="error">
            El texto vigente ({texto.version}) es un BORRADOR sin aprobar. En producción la reserva web queda desactivada hasta guardar la
            versión aprobada por Fabio (sin marcar «borrador»).
          </Alerta>
        ) : (
          <p className="text-sm text-gris-600">Versión vigente: {texto.version}.</p>
        )}
        <FormularioAutorizacion texto={texto && !texto.demostracion ? texto.texto : ""} borrador={texto ? texto.borrador || texto.demostracion : true} />
        {versiones.length > 0 && (
          <details className="border border-gris-200 bg-white p-4">
            <summary className="cursor-pointer text-sm text-gris-800">Versiones ({versiones.length})</summary>
            <ol className="mt-3 grid gap-3">
              {versiones.map((v, i) => (
                <li key={v.version} className="border-t border-gris-200 pt-3 text-sm">
                  <p className="text-gris-800">
                    {v.version}
                    {i === 0 && " · vigente"}
                    {v.demostracion && " · demostración"}
                    {v.borrador && " · borrador"}
                  </p>
                  <p className="text-xs text-gris-600">
                    {formatearFechaCorta(v.creadoEn)} {formatearHora(v.creadoEn)} · {v.creadoPor ?? "script de carga"}
                  </p>
                  <details className="mt-1">
                    <summary className="cursor-pointer text-xs text-gris-600 underline underline-offset-4">Ver texto</summary>
                    <p className="mt-2 whitespace-pre-line font-serif text-[0.9375rem] leading-relaxed text-gris-600">{v.texto}</p>
                  </details>
                </li>
              ))}
            </ol>
          </details>
        )}
      </section>
      <section className="grid gap-2 font-sans">
        <h2 className="text-sm uppercase tracking-[0.14em] text-gris-600">Política de tratamiento de datos</h2>
        {politica.publicable ? (
          <p className="text-sm text-gris-600">
            Publicada en{" "}
            <a href={RUTA_POLITICA} target="_blank" rel="noopener" className="underline underline-offset-4">
              {RUTA_POLITICA}
            </a>
            .
          </p>
        ) : (
          <Alerta tono="error">
            Sin publicar: el sitio no la enlaza y en producción la página no existe. Falta: {politica.faltantes.join("; ")}.
            {politica.texto && (
              <>
                {" "}
                <a href={RUTA_POLITICA} target="_blank" rel="noopener" className="underline underline-offset-4">
                  Ver borrador
                </a>{" "}
                (solo fuera de producción).
              </>
            )}
          </Alerta>
        )}
        <FormularioPolitica texto={politica.texto ?? ""} />
      </section>
    </div>
  );
}
