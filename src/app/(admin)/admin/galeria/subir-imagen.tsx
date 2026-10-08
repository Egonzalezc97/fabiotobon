"use client";

import { useId, useState } from "react";

const MAXIMO = 15 * 1024 * 1024;

/**
 * Sube una imagen a la galería y deja su id en un campo oculto.
 * accept limitado a JPEG, PNG y WebP: así el iPhone convierte las fotos HEIC a JPEG al elegirlas.
 * El servidor igual rechaza HEIC con un mensaje claro (respaldo).
 */
export function SubirImagen({ name, etiqueta, inicial, bloqueada }: { name: string; etiqueta: string; inicial?: string | null; bloqueada?: boolean }) {
  const id = useId();
  const [imagenId, setImagenId] = useState(inicial ?? "");
  const [estado, setEstado] = useState<{ subiendo?: boolean; error?: string }>({});

  async function alElegir(evento: React.ChangeEvent<HTMLInputElement>) {
    const archivo = evento.target.files?.[0];
    evento.target.value = "";
    if (!archivo) return;
    if (/hei[cf]/i.test(archivo.type) || /\.hei[cf]$/i.test(archivo.name)) {
      setEstado({ error: "Esta foto está en formato HEIC. Elígela desde la galería del iPhone con este botón (se convierte a JPEG) o expórtala como JPEG." });
      return;
    }
    if (archivo.size > MAXIMO) {
      setEstado({ error: "La imagen supera 15 MB." });
      return;
    }
    setEstado({ subiendo: true });
    const datos = new FormData();
    datos.set("archivo", archivo);
    try {
      const respuesta = await fetch("/api/panel/galeria/subir", { method: "POST", body: datos });
      const tipo = respuesta.headers.get("content-type") ?? "";
      if (!tipo.includes("application/json")) {
        setEstado({ error: "Tu sesión terminó. Vuelve a ingresar y repite la subida." });
        return;
      }
      const cuerpo = (await respuesta.json()) as { id?: string; error?: string };
      if (!respuesta.ok || !cuerpo.id) {
        setEstado({ error: cuerpo.error ?? "No se pudo subir la imagen." });
        return;
      }
      setImagenId(cuerpo.id);
      setEstado({});
    } catch {
      setEstado({ error: "No se pudo subir la imagen. Revisa la conexión e intenta de nuevo." });
    }
  }

  return (
    <div className="grid gap-2 font-sans">
      <span className="text-sm text-gris-800">{etiqueta}</span>
      <input type="hidden" name={name} value={imagenId} />
      <div className="aspect-[3/2] w-full overflow-hidden border border-gris-200 bg-gris-100">
        {imagenId ? (
          // Vista previa privada (pasa por la ruta del panel con auditoría); no se optimiza con next/image.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/panel/archivos/imagen/${imagenId}?ancho=480`} alt={etiqueta} className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full items-center justify-center text-sm text-gris-600">Sin imagen</span>
        )}
      </div>
      {!bloqueada && (
        <label
          htmlFor={id}
          className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-[2px] border border-gris-200 bg-white px-4 text-sm text-gris-800 hover:border-gris-800 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-azul"
        >
          {estado.subiendo ? "Subiendo…" : imagenId ? "Cambiar imagen" : "Elegir imagen"}
          <input id={id} type="file" accept="image/jpeg,image/png,image/webp" onChange={alElegir} disabled={estado.subiendo} className="sr-only" />
        </label>
      )}
      {estado.error && (
        <p role="alert" className="text-sm text-red-700">
          {estado.error}
        </p>
      )}
      {!bloqueada && <p className="text-xs text-gris-600">JPEG, PNG o WebP, hasta 15 MB. Se quitan los metadatos (EXIF y ubicación) al subir.</p>}
    </div>
  );
}
