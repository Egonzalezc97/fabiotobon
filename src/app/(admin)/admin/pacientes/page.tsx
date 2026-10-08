import type { Metadata } from "next";
import Link from "next/link";
import { requerirPanel } from "@/lib/auth/servidor";
import { db } from "@/lib/db";
import { formatearFechaCorta, horaLocal } from "@/modules/agenda/tiempo";
import { COLUMNAS_ORDEN, listarTablaPacientes, TAMANO_PAGINA, type ColumnaOrden } from "@/modules/pacientes";
import { formatearDocumento } from "@/modules/pacientes/documento";
import { formatearPrecio } from "@/modules/servicios";
import { NOMBRES_ESTADO_PAGO, type EstadoPago } from "@/modules/tratamientos";
import { Boton, EnlaceBoton, Etiqueta, Titulo } from "@/components/panel/ui";

export const metadata: Metadata = { title: "Pacientes" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const ENCABEZADOS: { columna: ColumnaOrden; texto: string; derecha?: boolean }[] = [
  { columna: "nombre", texto: "Paciente" },
  { columna: "documento", texto: "Documento" },
  { columna: "estado", texto: "Estado" },
  { columna: "estado_pago", texto: "Estado de pago" },
  { columna: "saldo", texto: "Saldo", derecha: true },
  { columna: "proxima_cita", texto: "Próxima cita" },
];

const uno = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

function tonoPago(estado: string) {
  return estado === "con_saldo" || estado === "sin_abonos" ? "alerta" : "neutro";
}

export default async function Pacientes({ searchParams }: Props) {
  const usuario = await requerirPanel();
  const sp = await searchParams;
  const filtros = {
    termino: uno(sp.q),
    estado: uno(sp.estado) === "activo" || uno(sp.estado) === "inactivo" ? (uno(sp.estado) as "activo" | "inactivo") : null,
    estadoPago: uno(sp.pago) || null,
    conCitaProxima: uno(sp.proxima) === "si",
    orden: (COLUMNAS_ORDEN as readonly string[]).includes(uno(sp.orden)) ? (uno(sp.orden) as ColumnaOrden) : "nombre",
    direccion: uno(sp.dir) === "desc" ? ("desc" as const) : ("asc" as const),
    pagina: Number(uno(sp.pagina)) || 1,
  };
  const { filas, total, pagina } = await listarTablaPacientes(db(), filtros, { userId: usuario.userId });
  const paginas = Math.max(1, Math.ceil(total / TAMANO_PAGINA));

  /** URL con los filtros actuales y los cambios indicados. */
  const url = (cambios: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const base: Record<string, string> = {
      q: filtros.termino,
      estado: filtros.estado ?? "",
      pago: filtros.estadoPago ?? "",
      proxima: filtros.conCitaProxima ? "si" : "",
      orden: filtros.orden,
      dir: filtros.direccion,
      pagina: String(pagina),
    };
    for (const [k, v] of Object.entries({ ...base, ...cambios })) if (v) p.set(k, v);
    return `/admin/pacientes?${p.toString()}`;
  };

  return (
    <div className="grid gap-5">
      <Titulo accion={<EnlaceBoton href="/admin/pacientes/nuevo">Nuevo paciente</EnlaceBoton>}>Pacientes</Titulo>

      <form className="grid gap-3 border border-gris-200 bg-white p-4 font-sans text-sm md:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto] md:items-end" role="search">
        <div>
          <label htmlFor="q" className="block">Buscar</label>
          <input id="q" name="q" defaultValue={filtros.termino} placeholder="Nombre, documento o celular" className="mt-1 min-h-11 w-full rounded-[2px] border border-gris-200 px-3 outline-none focus:border-azul" />
        </div>
        <div>
          <label htmlFor="estado" className="block">Estado</label>
          <select id="estado" name="estado" defaultValue={filtros.estado ?? ""} className="mt-1 min-h-11 w-full rounded-[2px] border border-gris-200 bg-white px-2">
            <option value="">Todos</option>
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
          </select>
        </div>
        <div>
          <label htmlFor="pago" className="block">Estado de pago</label>
          <select id="pago" name="pago" defaultValue={filtros.estadoPago ?? ""} className="mt-1 min-h-11 w-full rounded-[2px] border border-gris-200 bg-white px-2">
            <option value="">Todos</option>
            {Object.entries(NOMBRES_ESTADO_PAGO).map(([v, n]) => (
              <option key={v} value={v}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <label className="flex min-h-11 items-center gap-2">
          <input type="checkbox" name="proxima" value="si" defaultChecked={filtros.conCitaProxima} className="size-5 accent-azul" />
          Con cita próxima
        </label>
        <input type="hidden" name="orden" value={filtros.orden} />
        <input type="hidden" name="dir" value={filtros.direccion} />
        <Boton variante="secundario">Filtrar</Boton>
      </form>

      <p className="font-sans text-sm text-gris-600">
        {total} {total === 1 ? "paciente" : "pacientes"}
        {paginas > 1 && ` · página ${pagina} de ${paginas}`}
      </p>

      {/* Escritorio: tabla con orden por columna. */}
      <div className="hidden overflow-x-auto border border-gris-200 bg-white md:block">
        <table className="w-full font-sans text-sm">
          <thead>
            <tr className="border-b border-gris-200 text-left">
              {ENCABEZADOS.map((e) => {
                const activa = filtros.orden === e.columna;
                const siguiente = activa && filtros.direccion === "asc" ? "desc" : "asc";
                return (
                  <th key={e.columna} scope="col" aria-sort={activa ? (filtros.direccion === "asc" ? "ascending" : "descending") : "none"} className={`px-4 py-2 font-normal ${e.derecha ? "text-right" : ""}`}>
                    <Link href={url({ orden: e.columna, dir: siguiente, pagina: "1" })} className={`inline-flex min-h-9 items-center gap-1 ${activa ? "text-gris-800" : "text-gris-600 hover:text-gris-800"}`}>
                      {e.texto}
                      <span aria-hidden="true">{activa ? (filtros.direccion === "asc" ? "↑" : "↓") : ""}</span>
                    </Link>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.id} className="border-b border-gris-200 last:border-0 hover:bg-papel">
                <td className="px-4 py-2.5">
                  <Link href={`/admin/pacientes/${f.id}`} prefetch={false} className="underline-offset-4 hover:underline">
                    {f.nombre}
                  </Link>
                </td>
                <td className="px-4 py-2.5 tabular-nums text-gris-600">{formatearDocumento(f.tipo_documento, f.numero_documento)}</td>
                <td className="px-4 py-2.5">{f.estado === "activo" ? "Activo" : "Inactivo"}</td>
                <td className="px-4 py-2.5">
                  <Etiqueta tono={tonoPago(f.estado_pago)}>{NOMBRES_ESTADO_PAGO[f.estado_pago as EstadoPago] ?? f.estado_pago}</Etiqueta>
                </td>
                <td className={`px-4 py-2.5 text-right tabular-nums ${f.saldo > 0 ? "text-red-700" : ""}`}>
                  {f.saldo === 0 ? "—" : `${f.saldo < 0 ? "a favor " : ""}${formatearPrecio(Math.abs(f.saldo))}`}
                </td>
                <td className="px-4 py-2.5 tabular-nums">{f.proxima_cita ? `${formatearFechaCorta(f.proxima_cita)} · ${horaLocal(f.proxima_cita)}` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Celular: tarjetas. */}
      <ul className="grid gap-2 md:hidden">
        {filas.map((f) => (
          <li key={f.id}>
            <Link href={`/admin/pacientes/${f.id}`} prefetch={false} className="grid gap-1 border border-gris-200 bg-white p-3 font-sans">
              <span className="flex items-start justify-between gap-2">
                <span className="font-medium">{f.nombre}</span>
                <Etiqueta tono={tonoPago(f.estado_pago)}>{NOMBRES_ESTADO_PAGO[f.estado_pago as EstadoPago] ?? f.estado_pago}</Etiqueta>
              </span>
              <span className="text-sm text-gris-600">
                {formatearDocumento(f.tipo_documento, f.numero_documento)}
                {f.estado === "inactivo" ? " · inactivo" : ""}
              </span>
              <span className="flex justify-between text-sm tabular-nums">
                <span>{f.proxima_cita ? `Próxima: ${formatearFechaCorta(f.proxima_cita)} · ${horaLocal(f.proxima_cita)}` : "Sin cita próxima"}</span>
                {f.saldo !== 0 && <span className={f.saldo > 0 ? "text-red-700" : ""}>{f.saldo < 0 ? "a favor " : ""}{formatearPrecio(Math.abs(f.saldo))}</span>}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {paginas > 1 && (
        <nav aria-label="Páginas" className="flex items-center gap-2 font-sans text-sm">
          {pagina > 1 ? (
            <Link href={url({ pagina: String(pagina - 1) })} className="inline-flex min-h-11 items-center rounded-[2px] border border-gris-200 bg-white px-3">
              ← Anterior
            </Link>
          ) : null}
          <span className="px-2 text-gris-600">
            {pagina} / {paginas}
          </span>
          {pagina < paginas ? (
            <Link href={url({ pagina: String(pagina + 1) })} className="inline-flex min-h-11 items-center rounded-[2px] border border-gris-200 bg-white px-3">
              Siguiente →
            </Link>
          ) : null}
        </nav>
      )}
      <p className="font-sans text-xs text-gris-600">Cada consulta de esta tabla queda registrada en la auditoría.</p>
    </div>
  );
}
