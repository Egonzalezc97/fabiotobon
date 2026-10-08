"use server";

import { redirect } from "next/navigation";
import {
  completarReserva,
  iniciarReserva,
  reenviarCodigo,
  verificarCodigo,
  type ErroresCampos,
  type ResultadoReserva,
} from "@/modules/agenda/reserva-publica";
import { fechaLocal } from "@/modules/agenda/tiempo";
import { contextoReserva, db, entornoReserva, guardarTokenReserva, leerTokenReserva } from "./comun";

// Acciones de la reserva pública: leen el formulario, llaman al módulo de agenda y deciden a dónde ir.
// Ninguna regla de negocio vive aquí.

export type EstadoFormulario = { errores?: ErroresCampos; mensaje?: string; valores?: Record<string, string> };

const texto = (f: FormData, clave: string) => String(f.get(clave) ?? "").slice(0, 300);

function fechaValida(valor: string): Date | null {
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

export async function enviarDatos(_previo: EstadoFormulario, formulario: FormData): Promise<EstadoFormulario> {
  const inicio = fechaValida(texto(formulario, "inicio"));
  if (!inicio) redirect("/reservar");
  const valores = {
    tipoDocumento: texto(formulario, "tipoDocumento"),
    numeroDocumento: texto(formulario, "numeroDocumento"),
    nombre: texto(formulario, "nombre"),
    celular: texto(formulario, "celular"),
    correo: texto(formulario, "correo"),
  };
  const resultado = await iniciarReserva(
    db(),
    {
      ...valores,
      servicioId: texto(formulario, "servicioId"),
      inicio,
      aceptaAutorizacion: formulario.get("aceptaAutorizacion") === "si",
      versionAutorizacion: texto(formulario, "versionAutorizacion"),
    },
    entornoReserva(),
    await contextoReserva(),
  );

  if (resultado.ok) {
    await guardarTokenReserva(resultado.token);
    redirect("/reservar/codigo");
  }
  switch (resultado.motivo) {
    case "campos":
      return { errores: resultado.errores, valores };
    case "cupo_no_disponible":
      redirect(`/reservar?fecha=${fechaLocal(inicio)}&aviso=ocupado`);
    case "limite":
      return {
        mensaje: "Hiciste varias solicitudes seguidas. Intenta de nuevo en un rato o escríbenos por WhatsApp.",
        valores,
      };
    case "autorizacion_cambio":
      return { mensaje: "El texto de la autorización se actualizó. Léelo y acéptalo de nuevo.", valores };
    case "no_disponible":
      redirect("/reservar");
  }
}

function destino(resultado: ResultadoReserva): string | EstadoFormulario {
  switch (resultado.tipo) {
    case "creada":
      return "/reservar/listo";
    case "cupo_ocupado":
      return `/reservar/otro-horario?fecha=${resultado.fecha}`;
    case "limite_valoraciones":
      return `/reservar/no-completada?motivo=${resultado.especifico ? "valoracion" : "generico"}`;
    case "autorizacion_cambio":
      return "/reservar/no-completada?motivo=autorizacion";
    case "no_valida":
      return "/reservar?aviso=vencida";
    case "codigo_invalido":
      return {
        mensaje: `El código no coincide. ${resultado.intentosRestantes === 1 ? "Te queda 1 intento." : `Te quedan ${resultado.intentosRestantes} intentos.`}`,
      };
    case "codigo_vencido":
      return { mensaje: "El código venció. Pide uno nuevo." };
    case "limite":
      return { mensaje: "Superaste el número de intentos. Vuelve a empezar en un rato o escríbenos por WhatsApp." };
  }
}

export async function enviarCodigo(_previo: EstadoFormulario, formulario: FormData): Promise<EstadoFormulario> {
  const resultado = await verificarCodigo(db(), await leerTokenReserva(), texto(formulario, "codigo"), await contextoReserva());
  const siguiente = destino(resultado);
  if (typeof siguiente === "string") redirect(siguiente);
  return siguiente;
}

export async function pedirOtroCodigo(): Promise<EstadoFormulario> {
  const r = await reenviarCodigo(db(), await leerTokenReserva(), entornoReserva().emisor, await contextoReserva());
  if (r.ok) return { mensaje: "Te enviamos un código nuevo." };
  if (r.motivo === "espera") return { mensaje: "Espera un minuto antes de pedir otro código." };
  if (r.motivo === "limite") return { mensaje: "Pediste varios códigos seguidos. Intenta más tarde o escríbenos por WhatsApp." };
  redirect("/reservar?aviso=vencida");
}

export async function elegirOtroHorario(_previo: EstadoFormulario, formulario: FormData): Promise<EstadoFormulario> {
  const inicio = fechaValida(texto(formulario, "inicio"));
  if (!inicio) return { mensaje: "Elige un horario." };
  const resultado = await completarReserva(db(), await leerTokenReserva(), await contextoReserva(), inicio);
  if (resultado.tipo === "cupo_ocupado") return { mensaje: "Ese horario también se ocupó. Elige otro." };
  const siguiente = destino(resultado);
  if (typeof siguiente === "string") redirect(siguiente);
  return siguiente;
}
