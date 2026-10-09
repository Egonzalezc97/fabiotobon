import type { Metadata } from "next";
import Link from "next/link";
import { requerirAdmin } from "@/lib/auth/servidor";
import { listarUsuarios, NOMBRES_ROL } from "@/lib/auth/usuarios";
import { db } from "@/lib/db";
import { EnlaceBoton, Etiqueta, Titulo } from "@/components/panel/ui";

export const metadata: Metadata = { title: "Usuarios" };

export default async function Usuarios() {
  await requerirAdmin();
  const usuarios = await listarUsuarios(db());
  return (
    <div className="grid max-w-3xl gap-6">
      <Titulo accion={<EnlaceBoton href="/admin/usuarios/nuevo">Nuevo usuario</EnlaceBoton>}>Usuarios</Titulo>
      <p className="font-sans text-sm text-gris-600">
        Cada persona tiene su propia cuenta, con su contraseña y, si lo activa, su segundo factor. Nunca compartas una cuenta: la auditoría registra quién
        hizo cada cosa.
      </p>
      <ul className="divide-y divide-gris-200 border border-gris-200 bg-white font-sans">
        {usuarios.map((u) => (
          <li key={u.userId}>
            <Link
              href={`/admin/usuarios/${u.userId}`}
              className={`flex min-h-14 flex-wrap items-center justify-between gap-2 px-4 py-2 hover:bg-papel ${u.activo ? "" : "text-gris-600"}`}
            >
              <span>
                {u.nombre}
                <span className="block text-sm text-gris-600">
                  {u.usuario ?? "sin usuario"}
                  {u.correo ? ` · ${u.correo}` : " · sin correo"}
                </span>
              </span>
              <span className="flex flex-wrap gap-2">
                <Etiqueta tono={u.rol === "admin" ? "azul" : "neutro"}>{NOMBRES_ROL[u.rol]}</Etiqueta>
                {!u.activo && <Etiqueta>Inactivo</Etiqueta>}
                {u.activo && u.debeCambiarContrasena && <Etiqueta>Contraseña temporal</Etiqueta>}
                {u.activo && u.segundoFactor && <Etiqueta>Segundo factor</Etiqueta>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
