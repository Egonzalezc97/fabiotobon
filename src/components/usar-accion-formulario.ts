"use client";

import { useActionState, useTransition, type FormEvent } from "react";

/**
 * Envía un formulario a una acción de servidor SIN reiniciar sus campos.
 * Con <form action={…}>, React 19 vacía los campos al terminar la acción; si el servidor devuelve un
 * error, la persona perdería lo que escribió. Incluye el botón que envió el formulario (submitter).
 */
export function useAccionFormulario<S>(accion: (estado: Awaited<S>, datos: FormData) => Promise<S>, inicial: Awaited<S>) {
  const [estado, despachar, pendiente] = useActionState<S, FormData>(accion, inicial);
  const [, iniciar] = useTransition();
  function alEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const emisor = (evento.nativeEvent as SubmitEvent).submitter;
    const datos = new FormData(evento.currentTarget, emisor instanceof HTMLButtonElement ? emisor : undefined);
    iniciar(() => despachar(datos));
  }
  return { estado, alEnviar, pendiente };
}
