"use client";

import { useActionState } from "react";
import { enviarCodigo, pedirOtroCodigo, type EstadoFormulario } from "../acciones";
import { BotonEnviar, claseCampo, Etiqueta, Mensaje } from "../_campos";

export function FormularioCodigo() {
  const [estado, accion, pendiente] = useActionState<EstadoFormulario, FormData>(enviarCodigo, {});
  const [reenvio, reenviar, reenviando] = useActionState<EstadoFormulario>(pedirOtroCodigo, {});

  return (
    <div className="mt-10 grid max-w-xl gap-6">
      <form action={accion} className="grid gap-6">
        <div>
          <Etiqueta htmlFor="codigo">Código de 6 dígitos</Etiqueta>
          <input
            id="codigo"
            name="codigo"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]*"
            maxLength={7}
            required
            autoFocus
            className={`mt-1.5 max-w-[12rem] text-center text-2xl tracking-[0.3em] tabular-nums ${claseCampo()}`}
          />
        </div>
        <Mensaje texto={estado.mensaje} />
        <div>
          <BotonEnviar pendiente={pendiente}>{pendiente ? "Verificando…" : "Confirmar reserva"}</BotonEnviar>
        </div>
      </form>
      <form action={reenviar} className="border-t border-gris-200 pt-6">
        <p className="font-sans text-sm text-gris-600">¿No te llegó?</p>
        <button
          type="submit"
          disabled={reenviando}
          className="mt-1 font-sans text-[0.9375rem] text-gris-800 underline underline-offset-4 disabled:opacity-60"
        >
          {reenviando ? "Enviando…" : "Enviar otro código"}
        </button>
        {reenvio.mensaje && <p className="mt-2 font-sans text-sm text-gris-600">{reenvio.mensaje}</p>}
      </form>
    </div>
  );
}
