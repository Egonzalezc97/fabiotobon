/** Cinta obligatoria mientras el sitio muestre datos ficticios (CLAUDE.md). No se puede cerrar. */
export function CintaDemo() {
  return (
    <div
      role="note"
      className="sticky top-0 z-50 bg-azul px-4 py-2 text-center font-sans text-[0.8125rem] leading-snug text-white"
      style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
    >
      <strong className="font-medium uppercase tracking-[0.14em]">Contenido de demostración</strong>
      <span className="hidden sm:inline">
        {" · "}Servicios, precios, horarios, textos e imágenes son ficticios.
      </span>
    </div>
  );
}
