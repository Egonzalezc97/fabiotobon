import type { InputHTMLAttributes } from "react";

// Campos de las pantallas de acceso al panel. Esquinas de 2 px, sin sombras (CLAUDE.md).

type Props = InputHTMLAttributes<HTMLInputElement> & { etiqueta: string; id: string };

export function Campo({ etiqueta, id, className, ...resto }: Props) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block font-sans text-sm text-gris-800">
        {etiqueta}
      </label>
      <input
        id={id}
        className={`min-h-11 w-full rounded-[2px] border border-gris-200 bg-white px-3 py-2.5 font-sans text-[0.9375rem] text-gris-800 outline-none focus:border-azul focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-azul ${className ?? ""}`}
        {...resto}
      />
    </div>
  );
}

export function BotonPrincipal({ cargando, children }: { cargando: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={cargando}
      className="min-h-11 w-full rounded-[2px] bg-azul px-4 py-2.5 font-sans text-[0.9375rem] font-medium text-white transition-colors duration-150 hover:bg-azul-fuerte disabled:opacity-60"
    >
      {children}
    </button>
  );
}

/** Error dentro del formulario. Nunca revela si un correo existe. */
export function MensajeError({ mensaje }: { mensaje: string | null }) {
  if (!mensaje) return null;
  return (
    <p role="alert" className="border-l-2 border-red-700 bg-red-50 px-3 py-2 font-sans text-sm text-gris-800">
      {mensaje}
    </p>
  );
}
