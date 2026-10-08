import type { InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & { etiqueta: string; id: string };

export function Campo({ etiqueta, id, className, ...resto }: Props) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {etiqueta}
      </label>
      <input
        id={id}
        className={`w-full rounded-md border border-linea bg-white px-3 py-2.5 outline-none focus:border-acento focus:ring-2 focus:ring-acento/20 ${className ?? ""}`}
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
      className="w-full rounded-md bg-acento px-4 py-2.5 font-medium text-white hover:bg-acento-fuerte disabled:opacity-60"
    >
      {children}
    </button>
  );
}

export function MensajeError({ mensaje }: { mensaje: string | null }) {
  if (!mensaje) return null;
  return (
    <p role="alert" className="text-sm text-red-700">
      {mensaje}
    </p>
  );
}
