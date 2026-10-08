import { requerirAdmin } from "@/lib/auth/servidor";

// Vacío a propósito: los módulos del panel llegan desde la fase 2.
export default async function PanelInicio() {
  // Next renderiza layout y página en paralelo: cada página verifica por su cuenta, no confía en el layout.
  await requerirAdmin();
  return <h1 className="text-xl font-semibold">Panel</h1>;
}
