"use client";

import { useActionState } from "react";
import { enviarDatos, type EstadoFormulario } from "../acciones";
import { BotonEnviar, claseCampo, ErrorCampo, Etiqueta, Mensaje } from "../_campos";

type Props = {
  servicioId: string;
  inicio: string;
  documentoObligatorio: boolean;
  tiposDocumento: { valor: string; nombre: string }[];
  autorizacion: { version: string; texto: string; demostracion: boolean };
};

export function FormularioDatos({ servicioId, inicio, documentoObligatorio, tiposDocumento, autorizacion }: Props) {
  const [estado, accion, pendiente] = useActionState<EstadoFormulario, FormData>(enviarDatos, {});
  const e = estado.errores ?? {};
  const v = estado.valores ?? {};

  return (
    <form action={accion} className="mt-10 grid max-w-xl gap-6" noValidate>
      <input type="hidden" name="servicioId" value={servicioId} />
      <input type="hidden" name="inicio" value={inicio} />
      <input type="hidden" name="versionAutorizacion" value={autorizacion.version} />

      <fieldset className="grid gap-x-3 gap-y-1.5 sm:grid-cols-[minmax(0,14rem)_1fr]">
        <legend className="mb-1.5 font-sans text-sm text-gris-800">
          Documento de identidad {documentoObligatorio ? "" : <span className="text-gris-600">(opcional)</span>}
        </legend>
        <select
          name="tipoDocumento"
          aria-label="Tipo de documento"
          defaultValue={v.tipoDocumento || "CC"}
          className={claseCampo(e.documento)}
          aria-describedby={e.documento ? "error-documento" : "ayuda-documento"}
        >
          {tiposDocumento.map((t) => (
            <option key={t.valor} value={t.valor}>
              {t.nombre}
            </option>
          ))}
        </select>
        <input
          name="numeroDocumento"
          aria-label="Número de documento"
          defaultValue={v.numeroDocumento}
          inputMode="text"
          autoComplete="off"
          required={documentoObligatorio}
          className={claseCampo(e.documento)}
          aria-invalid={Boolean(e.documento)}
          aria-describedby={e.documento ? "error-documento" : "ayuda-documento"}
        />
        <p id="ayuda-documento" className="font-sans text-sm text-gris-600 sm:col-span-2">
          Si agendas para un menor, escribe el documento del menor.
        </p>
        <div className="sm:col-span-2">
          <ErrorCampo id="error-documento" mensaje={e.documento} />
        </div>
      </fieldset>

      <div>
        <Etiqueta htmlFor="nombre">Nombre completo</Etiqueta>
        <input
          id="nombre"
          name="nombre"
          defaultValue={v.nombre}
          autoComplete="name"
          required
          className={`mt-1.5 ${claseCampo(e.nombre)}`}
          aria-invalid={Boolean(e.nombre)}
          aria-describedby={e.nombre ? "error-nombre" : undefined}
        />
        <ErrorCampo id="error-nombre" mensaje={e.nombre} />
      </div>

      <div>
        <Etiqueta htmlFor="celular">Celular</Etiqueta>
        <input
          id="celular"
          name="celular"
          type="tel"
          defaultValue={v.celular}
          inputMode="tel"
          autoComplete="tel"
          placeholder="300 123 4567"
          required
          className={`mt-1.5 ${claseCampo(e.celular)}`}
          aria-invalid={Boolean(e.celular)}
          aria-describedby={e.celular ? "error-celular" : "ayuda-celular"}
        />
        <p id="ayuda-celular" className="mt-1.5 font-sans text-sm text-gris-600">
          Si no es de Colombia, escríbelo con el indicativo (+1, +34…).
        </p>
        <ErrorCampo id="error-celular" mensaje={e.celular} />
      </div>

      <div>
        <Etiqueta htmlFor="correo">
          Correo <span className="text-gris-600">(opcional)</span>
        </Etiqueta>
        <input
          id="correo"
          name="correo"
          type="email"
          defaultValue={v.correo}
          autoComplete="email"
          className={`mt-1.5 ${claseCampo(e.correo)}`}
          aria-invalid={Boolean(e.correo)}
          aria-describedby={e.correo ? "error-correo" : undefined}
        />
        <ErrorCampo id="error-correo" mensaje={e.correo} />
      </div>

      <div className="border-t border-gris-200 pt-6">
        <details className="group mb-4">
          <summary className="cursor-pointer font-sans text-sm text-gris-800 underline underline-offset-4">
            Leer la autorización de tratamiento de datos
          </summary>
          <div className="mt-3 max-h-64 overflow-y-auto whitespace-pre-line border border-gris-200 bg-papel p-4 font-serif text-[0.9375rem] leading-relaxed text-gris-600">
            {autorizacion.demostracion && (
              <strong className="mb-2 block font-sans text-xs uppercase tracking-[0.14em] text-azul">
                Texto de demostración, no válido legalmente
              </strong>
            )}
            {autorizacion.texto}
          </div>
        </details>
        <label className="flex items-start gap-3 font-sans text-[0.9375rem] text-gris-800">
          <input
            type="checkbox"
            name="aceptaAutorizacion"
            value="si"
            required
            className="mt-1 size-5 shrink-0 accent-azul"
            aria-invalid={Boolean(e.autorizacion)}
            aria-describedby={e.autorizacion ? "error-autorizacion" : undefined}
          />
          <span>He leído y acepto la autorización de tratamiento de datos.</span>
        </label>
        <ErrorCampo id="error-autorizacion" mensaje={e.autorizacion} />
      </div>

      <Mensaje texto={estado.mensaje} />
      <div>
        <BotonEnviar pendiente={pendiente}>{pendiente ? "Enviando…" : "Enviar código"}</BotonEnviar>
      </div>
    </form>
  );
}
