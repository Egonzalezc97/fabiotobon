"use client";

import { useAccionFormulario } from "@/components/usar-accion-formulario";
import { Alerta, Boton, CampoPanel, Casilla, SelectorPanel } from "@/components/panel/ui";
import {
  ajustarCostoAccion,
  anularAbonoAccion,
  cambiarEstadoTratamientoAccion,
  cancelarTratamientoAccion,
  crearTratamientoAccion,
  registrarAbonoAccion,
  type EstadoTrat,
} from "./acciones";

const pesos = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const caja = "grid gap-3 border border-gris-200 bg-white p-4";
const subtitulo = "font-sans text-sm uppercase tracking-[0.14em] text-gris-600";

function Resultado({ estado }: { estado: EstadoTrat }) {
  return (
    <>
      {estado.error && <Alerta tono="error">{estado.error}</Alerta>}
      {estado.ok && <Alerta tono="ok">{estado.ok}</Alerta>}
      {estado.excedente !== undefined && (
        <Casilla name="confirmaSaldoAFavor" value="si" etiqueta={`Confirmo que queda un saldo a favor del paciente de ${pesos.format(estado.excedente)}`} />
      )}
    </>
  );
}

export function NuevoTratamiento({ pacienteId, servicios }: { pacienteId: string; servicios: { id: string; nombre: string }[] }) {
  const { estado, alEnviar, pendiente } = useAccionFormulario<EstadoTrat>(crearTratamientoAccion, {});
  return (
    <form onSubmit={alEnviar} className={caja}>
      <input type="hidden" name="pacienteId" value={pacienteId} />
      <h2 className={subtitulo}>Nuevo tratamiento</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectorPanel etiqueta="Servicio (opcional)" id="servicioId" name="servicioId" defaultValue="">
          <option value="">Sin servicio: uso la descripción</option>
          {servicios.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nombre}
            </option>
          ))}
        </SelectorPanel>
        <CampoPanel etiqueta="Costo total acordado (COP)" id="costoTotal" name="costoTotal" inputMode="numeric" required placeholder="1.200.000" />
        <div className="sm:col-span-2">
          <CampoPanel etiqueta="Descripción" id="descripcion" name="descripcion" maxLength={500} placeholder="Qué incluye el tratamiento" />
        </div>
        <SelectorPanel etiqueta="Estado" id="estado" name="estado" defaultValue="presupuestado">
          <option value="presupuestado">Presupuestado (aún no es deuda)</option>
          <option value="en_curso">En curso</option>
        </SelectorPanel>
      </div>
      <Resultado estado={estado} />
      <div>
        <Boton pendiente={pendiente}>Crear tratamiento</Boton>
      </div>
    </form>
  );
}

export function RegistrarAbono({ tratamientoId, hoy }: { tratamientoId: string; hoy: string }) {
  const { estado, alEnviar, pendiente } = useAccionFormulario<EstadoTrat>(registrarAbonoAccion, {});
  return (
    <form onSubmit={alEnviar} className={caja}>
      <input type="hidden" name="tratamientoId" value={tratamientoId} />
      <h2 className={subtitulo}>Registrar abono</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <CampoPanel etiqueta="Valor (COP)" id="valor" name="valor" inputMode="numeric" required placeholder="200.000" />
        <CampoPanel etiqueta="Fecha" id="fecha" name="fecha" type="date" defaultValue={hoy} required />
        <SelectorPanel etiqueta="Medio" id="medio" name="medio" defaultValue="efectivo">
          <option value="efectivo">Efectivo</option>
          <option value="transferencia">Transferencia</option>
          <option value="tarjeta">Tarjeta</option>
          <option value="otro">Otro</option>
        </SelectorPanel>
        <CampoPanel etiqueta="Referencia (opcional)" id="referencia" name="referencia" maxLength={120} placeholder="N.º de transferencia o recibo" />
      </div>
      <Resultado estado={estado} />
      <div>
        <Boton pendiente={pendiente}>Registrar abono</Boton>
      </div>
    </form>
  );
}

export function AjustarCosto({ tratamientoId, costoActual }: { tratamientoId: string; costoActual: number }) {
  const { estado, alEnviar, pendiente } = useAccionFormulario<EstadoTrat>(ajustarCostoAccion, {});
  return (
    <form onSubmit={alEnviar} className={caja}>
      <input type="hidden" name="tratamientoId" value={tratamientoId} />
      <h2 className={subtitulo}>Ajustar costo</h2>
      <p className="font-sans text-sm text-gris-600">El costo inicial no se modifica: el ajuste queda en el historial con su motivo.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <CampoPanel etiqueta="Nuevo costo total (COP)" id="nuevoCosto" name="costoTotal" inputMode="numeric" required defaultValue={String(costoActual)} />
        <CampoPanel etiqueta="Motivo" id="motivoCosto" name="motivo" required minLength={3} maxLength={300} placeholder="Descuento, cambio del plan…" />
      </div>
      <Resultado estado={estado} />
      <div>
        <Boton variante="secundario" pendiente={pendiente}>
          Guardar ajuste
        </Boton>
      </div>
    </form>
  );
}

export function CambiarEstado({ tratamientoId, opciones }: { tratamientoId: string; opciones: { valor: string; nombre: string }[] }) {
  const { estado, alEnviar, pendiente } = useAccionFormulario<EstadoTrat>(cambiarEstadoTratamientoAccion, {});
  if (opciones.length === 0) return null;
  return (
    <form onSubmit={alEnviar} className={caja}>
      <input type="hidden" name="tratamientoId" value={tratamientoId} />
      <h2 className={subtitulo}>Cambiar estado</h2>
      <div className="flex flex-wrap gap-2">
        {opciones.map((o) => (
          <Boton key={o.valor} name="estado" value={o.valor} variante="secundario" pendiente={pendiente}>
            {o.nombre}
          </Boton>
        ))}
      </div>
      <Resultado estado={estado} />
    </form>
  );
}

export function CancelarTratamiento({ tratamientoId, abonado }: { tratamientoId: string; abonado: number }) {
  const { estado, alEnviar, pendiente } = useAccionFormulario<EstadoTrat>(cancelarTratamientoAccion, {});
  return (
    <details className="border border-gris-200 bg-white p-4">
      <summary className="min-h-11 cursor-pointer content-center font-sans text-sm text-red-700">Cancelar tratamiento</summary>
      <form onSubmit={alEnviar} className="mt-3 grid gap-3">
        <input type="hidden" name="tratamientoId" value={tratamientoId} />
        <p className="font-sans text-sm text-gris-600">
          Indica el valor de lo realizado. El saldo se calcula contra ese valor: deuda si lo abonado es menor, saldo a favor si es mayor.
        </p>
        <CampoPanel
          etiqueta="Valor de lo realizado (COP)"
          id="valorRealizado"
          name="valorRealizado"
          inputMode="numeric"
          defaultValue={String(abonado)}
          ayuda={`Por defecto, lo abonado: ${pesos.format(abonado)}.`}
        />
        <CampoPanel etiqueta="Motivo" id="motivoCancelacion" name="motivo" required minLength={3} maxLength={300} />
        <Resultado estado={estado} />
        <div>
          <Boton variante="peligro" pendiente={pendiente}>
            Sí, cancelar tratamiento
          </Boton>
        </div>
      </form>
    </details>
  );
}

export function AnularAbono({ tratamientoId, abonoId }: { tratamientoId: string; abonoId: string }) {
  const { estado, alEnviar, pendiente } = useAccionFormulario<EstadoTrat>(anularAbonoAccion, {});
  if (estado.ok) return <span className="text-sm text-gris-600">{estado.ok}</span>;
  return (
    <details>
      <summary className="min-h-11 cursor-pointer content-center text-sm text-red-700 underline underline-offset-4">Anular</summary>
      <form onSubmit={alEnviar} className="mt-2 grid gap-2">
        <input type="hidden" name="tratamientoId" value={tratamientoId} />
        <input type="hidden" name="abonoId" value={abonoId} />
        <CampoPanel etiqueta="Motivo de la anulación" id={`motivo-${abonoId}`} name="motivo" required minLength={3} maxLength={300} />
        {estado.error && <Alerta tono="error">{estado.error}</Alerta>}
        <div>
          <Boton variante="peligro" pendiente={pendiente}>
            Anular abono
          </Boton>
        </div>
      </form>
    </details>
  );
}
