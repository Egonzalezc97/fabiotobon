import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { enmascararCelular } from "@/lib/telefono";
import { obtenerSolicitud } from "@/modules/agenda/reserva-publica";
import { Contenedor, Encabezado, ResumenCita } from "../_ui";
import { db, entornoReserva, leerTokenReserva } from "../comun";
import { FormularioCodigo } from "./formulario-codigo";

export const metadata: Metadata = { title: "Código · Agendar valoración" };

export default async function Codigo() {
  await connection();
  const solicitud = await obtenerSolicitud(db(), await leerTokenReserva(), new Date());
  if (!solicitud) redirect("/reservar?aviso=vencida");
  if (solicitud.estado === "verificada") redirect("/reservar/otro-horario");
  if (solicitud.estado === "completada") redirect("/reservar/listo");
  const emisor = entornoReserva().emisor;

  return (
    <Contenedor>
      <Encabezado paso="Paso 3 de 3" titulo="Escribe el código.">
        Lo enviamos a tu celular {enmascararCelular(solicitud.celular)}. Vence en 10 minutos.
      </Encabezado>
      {emisor?.nombre === "desarrollo" && (
        <p className="mt-6 max-w-xl font-sans text-sm text-gris-600">
          Entorno de pruebas: el código aparece en la consola del servidor. Aún no se envían mensajes reales.
        </p>
      )}
      <ResumenCita
        servicio={{ nombre: solicitud.servicioNombre, duracionMin: solicitud.servicioDuracionMin }}
        inicio={solicitud.inicio}
      />
      <FormularioCodigo />
    </Contenedor>
  );
}
