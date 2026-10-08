import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirAdmin } from "@/lib/auth/servidor";
import { listarUsuarios, NOMBRES_ROL } from "@/lib/auth/usuarios";
import { db } from "@/lib/db";
import { Alerta, Etiqueta, Titulo } from "@/components/panel/ui";
import { AccionesUsuario } from "./acciones-usuario";

export const metadata: Metadata = { title: "Usuario" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function DetalleUsuario({ params, searchParams }: Props) {
  const admin = await requerirAdmin();
  const { id } = await params;
  const { creado } = await searchParams;
  const usuario = (await listarUsuarios(db())).find((u) => u.userId === id);
  if (!usuario) notFound();
  return (
    <div className="grid max-w-2xl gap-6">
      <Link href="/admin/usuarios" className="font-sans text-sm text-gris-600 underline underline-offset-4">
        ← Usuarios
      </Link>
      <Titulo>{usuario.nombre}</Titulo>
      {creado && <Alerta tono="ok">Usuario creado. Entrégale en persona su nombre de usuario y la contraseña temporal.</Alerta>}
      <dl className="grid gap-x-6 gap-y-3 border border-gris-200 bg-white p-4 font-sans text-sm sm:grid-cols-2">
        <div>
          <dt className="text-gris-600">Nombre de usuario</dt>
          <dd className="font-mono">{usuario.usuario}</dd>
        </div>
        <div>
          <dt className="text-gris-600">Correo</dt>
          <dd>{usuario.correo ?? "Sin correo (la recuperación la hace un administrador)"}</dd>
        </div>
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <Etiqueta tono={usuario.rol === "admin" ? "azul" : "neutro"}>{NOMBRES_ROL[usuario.rol]}</Etiqueta>
          <Etiqueta>{usuario.activo ? "Activo" : "Inactivo"}</Etiqueta>
          <Etiqueta tono={usuario.segundoFactor ? "neutro" : "alerta"}>
            {usuario.segundoFactor ? "Segundo factor activo" : "Sin segundo factor"}
          </Etiqueta>
          {usuario.debeCambiarContrasena && <Etiqueta>Contraseña temporal pendiente de cambio</Etiqueta>}
        </div>
      </dl>
      <AccionesUsuario userId={usuario.userId} rol={usuario.rol} activo={usuario.activo} esYo={usuario.userId === admin.userId} />
    </div>
  );
}
