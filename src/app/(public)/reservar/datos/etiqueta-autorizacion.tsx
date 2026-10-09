import { RUTA_POLITICA } from "@/components/publico/rutas";

/**
 * Texto de la casilla de autorización. El enlace a la política solo aparece cuando la política está publicada:
 * nunca un enlace roto. Se abre en otra pestaña para no perder lo escrito en el formulario.
 */
export function EtiquetaAutorizacion({ politicaPublicada }: { politicaPublicada: boolean }) {
  return (
    <span>
      He leído y acepto la autorización de tratamiento de datos.
      {politicaPublicada && (
        <>
          {" "}
          Consulta la{" "}
          <a href={RUTA_POLITICA} target="_blank" rel="noopener" className="underline underline-offset-4 hover:decoration-2">
            política de tratamiento de datos personales
            <span className="sr-only"> (se abre en una pestaña nueva)</span>
          </a>
          .
        </>
      )}
    </span>
  );
}
