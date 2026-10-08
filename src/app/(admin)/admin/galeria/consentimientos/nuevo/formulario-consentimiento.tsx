"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alerta, Boton, CampoPanel, Casilla } from "@/components/panel/ui";

/** Se envía a una ruta de API (no a una acción de servidor) porque el documento puede pesar hasta 15 MB. */
export function FormularioConsentimientoImagen({ pacienteId, hoy, volver }: { pacienteId: string; hoy: string; volver: string }) {
  const router = useRouter();
  const [enFisico, setEnFisico] = useState(false);
  const [estado, setEstado] = useState<{ pendiente?: boolean; error?: string }>({});

  async function alEnviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setEstado({ pendiente: true });
    try {
      const respuesta = await fetch("/api/panel/galeria/consentimiento", { method: "POST", body: new FormData(evento.currentTarget) });
      if (!(respuesta.headers.get("content-type") ?? "").includes("application/json")) {
        setEstado({ error: "Tu sesión terminó. Vuelve a ingresar." });
        return;
      }
      const cuerpo = (await respuesta.json()) as { id?: string; error?: string };
      if (!respuesta.ok || !cuerpo.id) {
        setEstado({ error: cuerpo.error ?? "No se pudo registrar el consentimiento." });
        return;
      }
      router.push(volver);
      router.refresh();
    } catch {
      setEstado({ error: "No se pudo registrar. Revisa la conexión e intenta de nuevo." });
    }
  }

  return (
    <form onSubmit={alEnviar} className="grid gap-4 border border-gris-200 bg-white p-4 md:p-6">
      <input type="hidden" name="pacienteId" value={pacienteId} />
      <CampoPanel etiqueta="Fecha de firma" id="fechaFirma" name="fechaFirma" type="date" max={hoy} required />
      <Casilla name="enFisico" value="si" checked={enFisico} onChange={(e) => setEnFisico(e.target.checked)} etiqueta="La autorización escrita está en físico (no adjunto el documento)" />
      {enFisico ? (
        <CampoPanel etiqueta="¿Quién verificó el documento físico?" id="verificadoPor" name="verificadoPor" required minLength={3} maxLength={120} />
      ) : (
        <div className="font-sans">
          <label htmlFor="archivo" className="block text-sm text-gris-800">
            Documento firmado
          </label>
          <input
            id="archivo"
            name="archivo"
            type="file"
            required
            accept="application/pdf,image/jpeg,image/png"
            className="mt-1 block w-full text-sm file:mr-3 file:min-h-11 file:rounded-[2px] file:border file:border-gris-200 file:bg-white file:px-4 file:text-gris-800"
          />
          <p className="mt-1 text-xs text-gris-600">PDF, JPEG o PNG, hasta 15 MB. Queda privado; solo lo ven administradores.</p>
        </div>
      )}
      <CampoPanel etiqueta="Notas (opcional)" id="notas" name="notas" maxLength={500} />
      {estado.error && <Alerta tono="error">{estado.error}</Alerta>}
      <div>
        <Boton pendiente={estado.pendiente}>Registrar consentimiento</Boton>
      </div>
    </form>
  );
}
