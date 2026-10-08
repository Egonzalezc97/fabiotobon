"use client";

import { useAccionFormulario } from "@/components/usar-accion-formulario";
import { Alerta, Boton, CampoPanel, SelectorPanel } from "@/components/panel/ui";
import {
  cambiarActivoAccion,
  cambiarRolAccion,
  forzarCambioAccion,
  reiniciarSegundoFactorAccion,
  type EstadoUsuario,
} from "../acciones";

function Resultado({ estado }: { estado: EstadoUsuario }) {
  if (estado.error) return <Alerta tono="error">{estado.error}</Alerta>;
  if (estado.ok) return <Alerta tono="ok">{estado.ok}</Alerta>;
  return null;
}

const caja = "grid gap-3 border border-gris-200 bg-white p-4";
const subtitulo = "font-sans text-sm uppercase tracking-[0.14em] text-gris-600";

export function AccionesUsuario({
  userId,
  rol,
  activo,
  esYo,
}: {
  userId: string;
  rol: "admin" | "asistente";
  activo: boolean;
  esYo: boolean;
}) {
  const cambioRol = useAccionFormulario<EstadoUsuario>(cambiarRolAccion, {});
  const cambioActivo = useAccionFormulario<EstadoUsuario>(cambiarActivoAccion, {});
  const forzar = useAccionFormulario<EstadoUsuario>(forzarCambioAccion, {});
  const reiniciar = useAccionFormulario<EstadoUsuario>(reiniciarSegundoFactorAccion, {});

  return (
    <div className="grid gap-4">
      <form onSubmit={cambioRol.alEnviar} className={caja}>
        <input type="hidden" name="userId" value={userId} />
        <h2 className={subtitulo}>Rol</h2>
        <SelectorPanel etiqueta="Rol" id="rol" name="rol" defaultValue={rol}>
          <option value="asistente">Asistente</option>
          <option value="admin">Administrador</option>
        </SelectorPanel>
        <Resultado estado={cambioRol.estado} />
        <div>
          <Boton variante="secundario" pendiente={cambioRol.pendiente}>
            Guardar rol
          </Boton>
        </div>
      </form>

      <form onSubmit={forzar.alEnviar} className={caja}>
        <input type="hidden" name="userId" value={userId} />
        <h2 className={subtitulo}>Forzar cambio de contraseña</h2>
        <p className="font-sans text-sm text-gris-600">Pon una contraseña temporal; se cierran sus sesiones y deberá cambiarla al ingresar.</p>
        <CampoPanel
          etiqueta="Contraseña temporal (mínimo 12 caracteres)"
          id="temporal"
          name="temporal"
          minLength={12}
          required
          autoComplete="off"
          className="font-mono"
        />
        <Resultado estado={forzar.estado} />
        <div>
          <Boton variante="secundario" pendiente={forzar.pendiente}>
            Forzar cambio
          </Boton>
        </div>
      </form>

      <form onSubmit={reiniciar.alEnviar} className={caja}>
        <input type="hidden" name="userId" value={userId} />
        <h2 className={subtitulo}>Reiniciar segundo factor</h2>
        <p className="font-sans text-sm text-gris-600">Para cuando pierde el celular y los códigos de respaldo. Se cierran sus sesiones.</p>
        <CampoPanel etiqueta="Motivo (queda en auditoría)" id="motivo" name="motivo" minLength={5} required />
        <Resultado estado={reiniciar.estado} />
        <div>
          <Boton variante="secundario" pendiente={reiniciar.pendiente}>
            Reiniciar segundo factor
          </Boton>
        </div>
      </form>

      <form onSubmit={cambioActivo.alEnviar} className={caja}>
        <input type="hidden" name="userId" value={userId} />
        <input type="hidden" name="activo" value={activo ? "no" : "si"} />
        <h2 className={subtitulo}>{activo ? "Desactivar" : "Reactivar"}</h2>
        <p className="font-sans text-sm text-gris-600">
          {activo
            ? `Las cuentas no se borran: se desactivan y se cierran sus sesiones.${esYo ? " Es tu propia cuenta." : ""}`
            : "Devuelve el acceso con su contraseña y segundo factor actuales."}
        </p>
        <Resultado estado={cambioActivo.estado} />
        <div>
          <Boton variante={activo ? "peligro" : "secundario"} pendiente={cambioActivo.pendiente}>
            {activo ? "Desactivar usuario" : "Reactivar usuario"}
          </Boton>
        </div>
      </form>
    </div>
  );
}
