import { redirect } from "next/navigation";
import { requerirPanel } from "@/lib/auth/servidor";

export default async function PanelInicio() {
  // Next renderiza layout y página en paralelo: cada página verifica por su cuenta, no confía en el layout.
  await requerirPanel();
  redirect("/admin/agenda");
}
