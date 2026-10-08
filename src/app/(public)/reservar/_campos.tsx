// Campos de formulario del sitio público: grandes, legibles y cómodos en el celular.

const BASE =
  "w-full rounded-[2px] border bg-white px-3.5 py-3 font-sans text-base text-gris-800 outline-none transition-colors duration-150 focus:border-azul";

export function Etiqueta({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block font-sans text-sm text-gris-800">
      {children}
    </label>
  );
}

export function ErrorCampo({ id, mensaje }: { id: string; mensaje?: string }) {
  if (!mensaje) return null;
  return (
    <p id={id} className="mt-1.5 font-sans text-sm text-red-700">
      {mensaje}
    </p>
  );
}

export function claseCampo(error?: string) {
  return `${BASE} ${error ? "border-red-700" : "border-gris-200"}`;
}

export function BotonEnviar({ pendiente, children }: { pendiente: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={pendiente}
      className="inline-flex items-center rounded-[2px] bg-azul px-6 py-3.5 font-sans text-[0.9375rem] font-medium text-white transition-colors duration-150 hover:bg-azul-fuerte disabled:opacity-60"
    >
      {children}
    </button>
  );
}

export function Mensaje({ texto }: { texto?: string }) {
  if (!texto) return null;
  return (
    <p role="alert" className="border-l-2 border-azul bg-papel px-4 py-3 font-sans text-[0.9375rem] text-gris-800">
      {texto}
    </p>
  );
}
