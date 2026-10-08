import type { Metadata } from "next";
import Link from "next/link";
import { requerirAdmin } from "@/lib/auth/servidor";
import { db } from "@/lib/db";
import { listarCasosPanel } from "@/modules/galeria";
import { EnlaceBoton, Etiqueta, Titulo } from "@/components/panel/ui";

export const metadata: Metadata = { title: "Galería" };

export default async function Galeria() {
  await requerirAdmin();
  const casos = await listarCasosPanel(db());
  const publicados = casos.filter((c) => c.estado === "publicado").length;

  return (
    <div className="grid max-w-4xl gap-6">
      <Titulo accion={<EnlaceBoton href="/admin/galeria/nuevo">Nuevo caso</EnlaceBoton>}>Galería de antes y después</Titulo>
      <p className="font-sans text-sm text-gris-600">
        Solo se publican casos con consentimiento de uso de imagen. Los originales quedan privados y sin metadatos.
        {publicados === 0 && " Mientras no haya casos publicados, el sitio muestra el contenido de demostración o el marcador pendiente."}
      </p>
      <p className="font-sans text-sm">
        <Link href="/admin/galeria/consentimientos/nuevo" className="text-azul underline underline-offset-4">
          Registrar un consentimiento de uso de imagen
        </Link>
      </p>

      {casos.length === 0 ? (
        <p className="font-sans text-sm text-gris-600">Aún no hay casos.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {casos.map((c) => (
            <li key={c.id}>
              <Link href={`/admin/galeria/${c.id}`} prefetch={false} className="grid gap-2 border border-gris-200 bg-white p-3 font-sans hover:border-gris-800">
                <span className="grid grid-cols-2 gap-1">
                  {[c.imagen_antes_id, c.imagen_despues_id].map((img, i) => (
                    // Vista previa privada con auditoría; no pasa por next/image.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={img} src={`/api/panel/archivos/imagen/${img}?ancho=480`} alt={i === 0 ? "Antes" : "Después"} loading="lazy" className="aspect-[3/2] w-full bg-gris-100 object-cover" />
                  ))}
                </span>
                <span className="flex items-start justify-between gap-2">
                  <span>{c.procedimiento}</span>
                  <Etiqueta tono={c.estado === "publicado" ? "azul" : "neutro"}>{c.estado === "publicado" ? "Publicado" : "Borrador"}</Etiqueta>
                </span>
                <span className="text-xs text-gris-600">{c.pacienteNombre ? `Consentimiento: ${c.pacienteNombre}` : "Sin consentimiento"}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
