"use client";

import Link from "next/link";
import { useAccionFormulario } from "@/components/usar-accion-formulario";
import { Alerta, Boton, CampoPanel, SelectorPanel } from "@/components/panel/ui";
import { guardarCasoAccion, publicarAccion, type EstadoGaleria } from "./acciones";
import { SubirImagen } from "./subir-imagen";

type Caso = {
  id: string;
  procedimiento: string;
  servicio_id: string | null;
  descripcion: string;
  imagen_antes_id: string;
  imagen_despues_id: string;
  consentimiento_imagen_id: string | null;
  orden: number;
  estado: string;
};

export function FormularioCaso({
  caso,
  servicios,
  consentimientos,
}: {
  caso?: Caso;
  servicios: { id: string; nombre: string }[];
  consentimientos: { id: string; texto: string }[];
}) {
  const { estado, alEnviar, pendiente } = useAccionFormulario<EstadoGaleria>(guardarCasoAccion, {});
  const publicado = caso?.estado === "publicado";
  return (
    <form onSubmit={alEnviar} className="grid gap-5 border border-gris-200 bg-white p-4 md:p-6">
      {caso && <input type="hidden" name="casoId" value={caso.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <SubirImagen name="imagenAntesId" etiqueta="Antes" inicial={caso?.imagen_antes_id} bloqueada={publicado} />
        <SubirImagen name="imagenDespuesId" etiqueta="Después" inicial={caso?.imagen_despues_id} bloqueada={publicado} />
      </div>
      {publicado && <p className="font-sans text-sm text-gris-600">Para cambiar las imágenes o el consentimiento, primero retira el caso del sitio.</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoPanel etiqueta="Procedimiento" id="procedimiento" name="procedimiento" required minLength={2} maxLength={80} defaultValue={caso?.procedimiento} />
        <SelectorPanel etiqueta="Servicio relacionado (opcional)" id="servicioId" name="servicioId" defaultValue={caso?.servicio_id ?? ""}>
          <option value="">Ninguno</option>
          {servicios.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nombre}
            </option>
          ))}
        </SelectorPanel>
        <div className="sm:col-span-2">
          <CampoPanel etiqueta="Descripción corta" id="descripcion" name="descripcion" maxLength={200} defaultValue={caso?.descripcion} ayuda="Hasta 200 caracteres. Sin datos del paciente." />
        </div>
        <div className="sm:col-span-2">
          {publicado && <input type="hidden" name="consentimientoImagenId" value={caso.consentimiento_imagen_id ?? ""} />}
          <SelectorPanel
            etiqueta="Consentimiento de uso de imagen"
            id="consentimientoImagenId"
            name={publicado ? undefined : "consentimientoImagenId"}
            defaultValue={caso?.consentimiento_imagen_id ?? ""}
            disabled={publicado}
          >
            <option value="">Sin consentimiento (no se puede publicar)</option>
            {consentimientos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.texto}
              </option>
            ))}
          </SelectorPanel>
          <p className="mt-1 font-sans text-xs">
            <Link href={`/admin/galeria/consentimientos/nuevo${caso ? `?volver=${caso.id}` : ""}`} className="text-azul underline underline-offset-4">
              Registrar un consentimiento
            </Link>
          </p>
        </div>
        <CampoPanel etiqueta="Orden en el sitio" id="orden" name="orden" type="number" min={0} max={999} defaultValue={String(caso?.orden ?? 0)} ayuda="Menor número, primero." />
      </div>
      {estado.error && <Alerta tono="error">{estado.error}</Alerta>}
      {estado.ok && <Alerta tono="ok">{estado.ok}</Alerta>}
      <div>
        <Boton pendiente={pendiente}>{caso ? "Guardar cambios" : "Crear caso en borrador"}</Boton>
      </div>
    </form>
  );
}

export function PublicarCaso({ casoId, publicado, conConsentimiento }: { casoId: string; publicado: boolean; conConsentimiento: boolean }) {
  const { estado, alEnviar, pendiente } = useAccionFormulario<EstadoGaleria>(publicarAccion, {});
  return (
    <form onSubmit={alEnviar} className="grid gap-3 border border-gris-200 bg-white p-4">
      <input type="hidden" name="casoId" value={casoId} />
      <input type="hidden" name="operacion" value={publicado ? "despublicar" : "publicar"} />
      {publicado ? (
        <p className="font-sans text-sm">Publicado en el sitio. Al retirarlo se borran sus versiones públicas; los originales siguen privados.</p>
      ) : conConsentimiento ? (
        <p className="font-sans text-sm">En borrador. Al publicar se generan las versiones optimizadas para el sitio.</p>
      ) : (
        <p className="font-sans text-sm text-red-700">No se puede publicar: vincula primero un consentimiento de uso de imagen y guarda.</p>
      )}
      {estado.error && <Alerta tono="error">{estado.error}</Alerta>}
      {estado.ok && <Alerta tono="ok">{estado.ok}</Alerta>}
      <div>
        <Boton variante={publicado ? "peligro" : "principal"} pendiente={pendiente} disabled={!publicado && !conConsentimiento}>
          {pendiente ? (publicado ? "Retirando…" : "Publicando…") : publicado ? "Retirar del sitio" : "Publicar en el sitio"}
        </Boton>
      </div>
    </form>
  );
}
