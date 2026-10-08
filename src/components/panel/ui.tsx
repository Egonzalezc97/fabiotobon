import Link from "next/link";

// Piezas de interfaz del panel: sobrias, densas y cómodas en el celular (objetivos táctiles de 44 px).

export function Titulo({ children, accion }: { children: React.ReactNode; accion?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <h1 className="font-sans text-2xl font-normal tracking-[-0.01em] md:text-3xl">{children}</h1>
      {accion}
    </div>
  );
}

export function EnlaceBoton({
  href,
  children,
  variante = "principal",
  prefetch,
}: {
  href: string;
  children: React.ReactNode;
  variante?: "principal" | "secundario";
  prefetch?: boolean;
}) {
  return (
    <Link
      href={href}
      prefetch={prefetch}
      className={
        variante === "principal"
          ? "inline-flex min-h-11 items-center rounded-[2px] bg-azul px-4 font-sans text-sm font-medium text-white hover:bg-azul-fuerte"
          : "inline-flex min-h-11 items-center rounded-[2px] border border-gris-200 bg-white px-4 font-sans text-sm text-gris-800 hover:border-gris-800"
      }
    >
      {children}
    </Link>
  );
}

export function Boton({
  children,
  variante = "principal",
  pendiente,
  ...resto
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variante?: "principal" | "secundario" | "peligro"; pendiente?: boolean }) {
  const estilos = {
    principal: "bg-azul text-white hover:bg-azul-fuerte",
    secundario: "border border-gris-200 bg-white text-gris-800 hover:border-gris-800",
    peligro: "border border-red-700 bg-white text-red-700 hover:bg-red-50",
  }[variante];
  return (
    <button
      type="submit"
      disabled={pendiente || resto.disabled}
      {...resto}
      className={`inline-flex min-h-11 items-center justify-center rounded-[2px] px-4 font-sans text-sm font-medium disabled:opacity-60 ${estilos} ${resto.className ?? ""}`}
    >
      {children}
    </button>
  );
}

export function CampoPanel({
  etiqueta,
  id,
  ayuda,
  error,
  ...resto
}: React.InputHTMLAttributes<HTMLInputElement> & { etiqueta: string; id: string; ayuda?: string; error?: string }) {
  return (
    <div>
      <label htmlFor={id} className="block font-sans text-sm text-gris-800">
        {etiqueta}
      </label>
      <input
        id={id}
        {...resto}
        aria-invalid={Boolean(error) || undefined}
        className={`mt-1 min-h-11 w-full rounded-[2px] border bg-white px-3 font-sans text-[0.9375rem] outline-none focus:border-azul ${
          error ? "border-red-700" : "border-gris-200"
        } ${resto.className ?? ""}`}
      />
      {ayuda && !error && <p className="mt-1 font-sans text-xs text-gris-600">{ayuda}</p>}
      {error && <p className="mt-1 font-sans text-xs text-red-700">{error}</p>}
    </div>
  );
}

export function SelectorPanel({
  etiqueta,
  id,
  children,
  ...resto
}: React.SelectHTMLAttributes<HTMLSelectElement> & { etiqueta: string; id: string }) {
  return (
    <div>
      <label htmlFor={id} className="block font-sans text-sm text-gris-800">
        {etiqueta}
      </label>
      <select
        id={id}
        {...resto}
        className="mt-1 min-h-11 w-full rounded-[2px] border border-gris-200 bg-white px-3 font-sans text-[0.9375rem] outline-none focus:border-azul"
      >
        {children}
      </select>
    </div>
  );
}

export function Casilla({ etiqueta, ...resto }: React.InputHTMLAttributes<HTMLInputElement> & { etiqueta: React.ReactNode }) {
  return (
    <label className="flex min-h-11 items-center gap-3 font-sans text-[0.9375rem] text-gris-800">
      <input type="checkbox" {...resto} className="size-5 shrink-0 accent-azul" />
      <span>{etiqueta}</span>
    </label>
  );
}

export function Alerta({ tono = "info", children }: { tono?: "info" | "error" | "ok"; children: React.ReactNode }) {
  const estilos = { info: "border-azul bg-papel", error: "border-red-700 bg-red-50", ok: "border-gris-800 bg-papel" }[tono];
  return (
    <div role={tono === "error" ? "alert" : "status"} className={`border-l-2 px-4 py-3 font-sans text-sm text-gris-800 ${estilos}`}>
      {children}
    </div>
  );
}

export function Etiqueta({ children, tono = "neutro" }: { children: React.ReactNode; tono?: "neutro" | "azul" | "alerta" }) {
  const estilos = {
    neutro: "border-gris-200 text-gris-600",
    azul: "border-azul text-azul",
    alerta: "border-red-700 text-red-700",
  }[tono];
  return <span className={`inline-block border px-1.5 py-0.5 font-sans text-[0.6875rem] uppercase tracking-[0.1em] ${estilos}`}>{children}</span>;
}
