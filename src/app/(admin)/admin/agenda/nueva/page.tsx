import type { Metadata } from "next";
import { requerirAdmin } from "@/lib/auth/servidor";
import { db } from "@/lib/db";
import { esFechaLocal, fechaLocal, horaLocal } from "@/modules/agenda/tiempo";
import { leerParametros } from "@/modules/configuracion";
import { obtenerFicha } from "@/modules/pacientes";
import { TIPOS_DOCUMENTO } from "@/modules/pacientes/documento";
import { listarServiciosPanel } from "@/modules/servicios";
import { Titulo } from "@/components/panel/ui";
import { FormularioNuevaCita } from "./formulario-nueva-cita";

export const metadata: Metadata = { title: "Nueva cita" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function NuevaCita({ searchParams }: Props) {
  const admin = await requerirAdmin();
  const sp = await searchParams;
  const inicio = typeof sp.inicio === "string" ? new Date(sp.inicio) : null;
  const valido = inicio && !Number.isNaN(inicio.getTime());
  const fecha = valido ? fechaLocal(inicio) : typeof sp.fecha === "string" && esFechaLocal(sp.fecha) ? sp.fecha : fechaLocal(new Date());
  const hora = valido ? horaLocal(inicio) : "";

  const [servicios, parametros, ficha] = await Promise.all([
    listarServiciosPanel(db(), { soloActivos: true }),
    leerParametros(db()),
    typeof sp.pacienteId === "string" ? obtenerFicha(db(), sp.pacienteId, { userId: admin.userId }) : Promise.resolve(null),
  ]);

  return (
    <div className="grid max-w-2xl gap-6">
      <Titulo>Nueva cita</Titulo>
      <FormularioNuevaCita
        servicios={servicios.map((s) => ({ id: s.id, nombre: s.nombre, duracionMin: s.duracion_min }))}
        tiposDocumento={Object.entries(TIPOS_DOCUMENTO).map(([valor, nombre]) => ({ valor, nombre }))}
        fecha={fecha}
        hora={hora}
        pasoMinutos={parametros.granularidadMin}
        paciente={ficha ? { id: ficha.paciente.id, nombre: ficha.paciente.nombre } : null}
      />
    </div>
  );
}
