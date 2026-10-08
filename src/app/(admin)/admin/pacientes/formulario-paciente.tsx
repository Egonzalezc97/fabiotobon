"use client";

import { useAccionFormulario } from "@/components/usar-accion-formulario";
import { Alerta, Boton, CampoPanel, SelectorPanel } from "@/components/panel/ui";
import { actualizarPacienteAccion, crearPacienteAccion, type EstadoPaciente } from "./acciones";

type Paciente = {
  id: string;
  tipo_documento: string | null;
  numero_documento: string | null;
  nombre: string;
  celular: string | null;
  telefono: string | null;
  fecha_nacimiento: string | null;
  correo: string | null;
  estado: string;
  notas: string;
};

export function FormularioPaciente({
  paciente,
  tiposDocumento,
}: {
  paciente?: Paciente;
  tiposDocumento: { valor: string; nombre: string }[];
}) {
  const { estado, alEnviar, pendiente } = useAccionFormulario<EstadoPaciente>(
    paciente ? actualizarPacienteAccion : crearPacienteAccion,
    {},
  );
  return (
    <form onSubmit={alEnviar} className="grid gap-4 border border-gris-200 bg-white p-4">
      {paciente && <input type="hidden" name="id" value={paciente.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectorPanel etiqueta="Tipo de documento" id="tipoDocumento" name="tipoDocumento" defaultValue={paciente?.tipo_documento ?? "CC"}>
          {tiposDocumento.map((t) => (
            <option key={t.valor} value={t.valor}>
              {t.nombre}
            </option>
          ))}
        </SelectorPanel>
        <CampoPanel etiqueta="Número de documento" id="numeroDocumento" name="numeroDocumento" defaultValue={paciente?.numero_documento ?? ""} required />
        <div className="sm:col-span-2">
          <CampoPanel etiqueta="Nombre completo" id="nombre" name="nombre" defaultValue={paciente?.nombre} required />
        </div>
        <CampoPanel
          etiqueta="WhatsApp (celular)"
          id="celular"
          name="celular"
          type="tel"
          defaultValue={paciente?.celular ?? ""}
          ayuda="Si lo cambias, queda sin verificar hasta que el paciente reserve por la web."
        />
        <CampoPanel etiqueta="Teléfono adicional" id="telefono" name="telefono" type="tel" defaultValue={paciente?.telefono ?? ""} />
        <CampoPanel etiqueta="Fecha de nacimiento" id="fechaNacimiento" name="fechaNacimiento" type="date" defaultValue={paciente?.fecha_nacimiento ?? ""} />
        <CampoPanel etiqueta="Correo" id="correo" name="correo" type="email" defaultValue={paciente?.correo ?? ""} />
        {paciente && (
          <SelectorPanel etiqueta="Estado (DPF)" id="estado" name="estado" defaultValue={paciente.estado}>
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
          </SelectorPanel>
        )}
      </div>
      <div>
        <label htmlFor="notas" className="block font-sans text-sm">
          Notas administrativas (no son historia clínica)
        </label>
        <textarea id="notas" name="notas" rows={3} maxLength={2000} defaultValue={paciente?.notas} className="mt-1 w-full rounded-[2px] border border-gris-200 p-3 font-sans outline-none focus:border-azul" />
      </div>
      {estado.error && <Alerta tono="error">{estado.error}</Alerta>}
      {estado.ok && <Alerta tono="ok">{estado.ok}</Alerta>}
      <div>
        <Boton pendiente={pendiente}>{paciente ? "Guardar cambios" : "Crear paciente"}</Boton>
      </div>
    </form>
  );
}
