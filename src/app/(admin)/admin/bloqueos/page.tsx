import type { Metadata } from "next";
import { requerirPanel } from "@/lib/auth/servidor";
import { db } from "@/lib/db";
import { listarBloqueos } from "@/modules/agenda/bloqueos";
import { fechaLocal, horaLocal, instante, sumarDias } from "@/modules/agenda/tiempo";
import { leerParametros } from "@/modules/configuracion";
import { Titulo } from "@/components/panel/ui";
import { eliminarBloqueoAccion } from "./acciones";
import { FormularioBloqueo } from "./formulario-bloqueo";

export const metadata: Metadata = { title: "Bloqueos" };

const DIA = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", weekday: "long", day: "numeric", month: "long" });

export default async function Bloqueos() {
  await requerirPanel();
  const hoy = fechaLocal(new Date());
  const [bloqueos, { granularidadMin }] = await Promise.all([
    listarBloqueos(db(), { inicio: instante(hoy), fin: instante(sumarDias(hoy, 366)) }),
    leerParametros(db()),
  ]);

  return (
    <div className="grid max-w-3xl gap-6">
      <Titulo>Bloqueos</Titulo>
      <FormularioBloqueo hoy={hoy} pasoMinutos={granularidadMin} />
      <section className="grid gap-3">
        <h2 className="font-sans text-sm uppercase tracking-[0.14em] text-gris-600">Próximos bloqueos · {bloqueos.length}</h2>
        {bloqueos.length === 0 ? (
          <p className="font-sans text-sm text-gris-600">No hay bloqueos.</p>
        ) : (
          <ul className="divide-y divide-gris-200 border border-gris-200 bg-white font-sans">
            {bloqueos.map((b) => {
              const ultimoDia = new Date(b.fin.getTime() - 1);
              const cuando = b.dia_completo
                ? fechaLocal(b.inicio) === fechaLocal(ultimoDia)
                  ? `${DIA.format(b.inicio)} · todo el día`
                  : `Del ${DIA.format(b.inicio)} al ${DIA.format(ultimoDia)}`
                : `${DIA.format(b.inicio)} · ${horaLocal(b.inicio)}–${horaLocal(b.fin)}`;
              return (
                <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <span>
                    <span className="block first-letter:uppercase">{cuando}</span>
                    {b.motivo && <span className="block text-sm text-gris-600">{b.motivo}</span>}
                  </span>
                  <form action={eliminarBloqueoAccion}>
                    <input type="hidden" name="id" value={b.id} />
                    <button type="submit" className="min-h-11 px-2 text-sm text-red-700 underline underline-offset-4">
                      Quitar
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
