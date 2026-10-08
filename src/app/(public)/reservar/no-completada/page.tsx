import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { EnlaceWhatsapp } from "@/components/publico/enlaces";
import { datosSitio } from "@/lib/sitio";
import { Contenedor, Encabezado } from "../_ui";

export const metadata: Metadata = { title: "Reserva no completada" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

// "valoracion" solo se muestra cuando el celular verificado coincide con la ficha del documento.
// En cualquier otro caso el mensaje es genérico: no revela si un documento tiene citas.
const MENSAJES: Record<string, { titulo: string; texto: string }> = {
  valoracion: {
    titulo: "Ya tienes una valoración agendada.",
    texto: "Si necesitas cambiarla o agendar otra, escríbenos por WhatsApp.",
  },
  autorizacion: {
    titulo: "La autorización de datos se actualizó.",
    texto: "Vuelve a empezar para leer y aceptar el texto vigente.",
  },
  generico: {
    titulo: "No pudimos completar la reserva en línea.",
    texto: "Escríbenos por WhatsApp y te ayudamos a agendar.",
  },
};

export default async function NoCompletada({ searchParams }: Props) {
  await connection();
  const { motivo } = await searchParams;
  const m = MENSAJES[typeof motivo === "string" ? motivo : ""] ?? MENSAJES.generico!;
  const { contacto } = await datosSitio();
  return (
    <Contenedor>
      <Encabezado titulo={m.titulo}>{m.texto}</Encabezado>
      <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-5">
        <EnlaceWhatsapp enlace={contacto.enlaceWhatsapp} className="text-gris-800" />
        <Link href="/reservar" className="font-sans text-[0.9375rem] text-gris-600 underline-offset-[6px] hover:underline">
          Empezar de nuevo
        </Link>
      </div>
    </Contenedor>
  );
}
