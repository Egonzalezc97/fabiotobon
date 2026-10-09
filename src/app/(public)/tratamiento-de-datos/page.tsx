import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Markdown, { type Components } from "react-markdown";
import { db } from "@/lib/db";
import { esProduccion } from "@/lib/despliegue";
import { leerPolitica } from "@/modules/configuracion";

export const metadata: Metadata = { title: "Tratamiento de datos personales" };
// Se lee de la configuración en cada visita: la política se actualiza sin desplegar.
export const dynamic = "force-dynamic";

// El texto lo edita un admin, pero igual no se interpreta HTML crudo (skipHtml).
const COMPONENTES: Components = {
  h1: ({ children }) => (
    <h1 className="font-sans text-[clamp(2rem,5vw,3.25rem)] font-light leading-[1.05] tracking-[-0.01em] text-gris-800">{children}</h1>
  ),
  h2: ({ children }) => <h2 className="mt-12 font-sans text-xl font-normal text-gris-800">{children}</h2>,
  h3: ({ children }) => <h3 className="mt-8 font-sans text-lg font-normal text-gris-800">{children}</h3>,
  // Un salto de línea simple del texto se respeta (quien lo edita en el panel no conoce la sintaxis de markdown).
  p: ({ children }) => <p className="mt-4 whitespace-pre-line font-serif text-[1.0625rem] leading-relaxed text-gris-600">{children}</p>,
  ul: ({ children }) => <ul className="mt-4 list-disc space-y-2 pl-5 font-serif text-[1.0625rem] leading-relaxed text-gris-600">{children}</ul>,
  ol: ({ children }) => <ol className="mt-4 list-decimal space-y-2 pl-5 font-serif text-[1.0625rem] leading-relaxed text-gris-600">{children}</ol>,
  blockquote: ({ children }) => <blockquote className="mt-6 border-l-2 border-gris-200 pl-4 [&>p]:mt-2">{children}</blockquote>,
  strong: ({ children }) => <strong className="font-semibold text-gris-800">{children}</strong>,
  a: ({ children, href }) => (
    <a href={href} className="break-words text-gris-800 underline underline-offset-4 hover:decoration-2">
      {children}
    </a>
  ),
};

export default async function TratamientoDeDatos() {
  const politica = await leerPolitica(db());
  // En producción, una política incompleta o sin aprobar no existe.
  if (!politica.publicable && esProduccion(process.env)) notFound();

  return (
    <article className="mx-auto max-w-[84rem] px-5 pb-24 pt-12 md:px-10 md:pt-20">
      <div className="max-w-2xl">
        {!politica.publicable && (
          <div role="note" className="mb-10 border-l-2 border-azul bg-papel px-4 py-3 font-sans text-sm text-gris-800">
            <strong className="font-medium uppercase tracking-[0.14em]">Borrador sin publicar</strong>
            <p className="mt-1 text-gris-600">
              Solo se ve fuera de producción. Para publicarla falta: {politica.faltantes.join("; ")}.
            </p>
          </div>
        )}
        {politica.texto ? (
          <Markdown skipHtml components={COMPONENTES}>
            {politica.texto}
          </Markdown>
        ) : (
          <p className="font-sans text-gris-600">
            No hay política cargada. En desarrollo: <code>npm run politica:cargar-borrador</code>, o cárgala en Panel → Configuración.
          </p>
        )}
      </div>
    </article>
  );
}
