// Sin dependencias de servidor: lo usan también los formularios (componentes de cliente).
export function TituloAcceso({ children }: { children: React.ReactNode }) {
  return <h1 className="font-sans text-[1.75rem] font-light leading-tight tracking-[-0.01em] text-gris-800">{children}</h1>;
}
