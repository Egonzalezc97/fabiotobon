import type { Metadata } from "next";
import { requerirPanel } from "@/lib/auth/servidor";
import { db } from "@/lib/db";
import { Titulo } from "@/components/panel/ui";
import { ActivarSegundoFactor } from "./activar-segundo-factor";
import { DesactivarSegundoFactor } from "./desactivar-segundo-factor";

export const metadata: Metadata = { title: "Mi cuenta" };

export default async function MiCuenta() {
  const yo = await requerirPanel();
  const cuenta = await db().selectFrom("user").select("twoFactorEnabled").where("id", "=", yo.userId).executeTakeFirstOrThrow();
  const activo = Boolean(cuenta.twoFactorEnabled);

  return (
    <div className="grid max-w-2xl gap-6 font-sans">
      <Titulo>Mi cuenta</Titulo>
      <p className="text-sm text-gris-600">
        {yo.nombre} · usuario <span className="text-gris-800">{yo.usuario}</span>
      </p>
      <section className="grid gap-2 border border-gris-200 bg-white p-4">
        <h2 className="text-sm uppercase tracking-[0.14em] text-gris-600">Verificación en dos pasos (opcional)</h2>
        {activo ? (
          <>
            <p className="text-[0.9375rem] text-gris-800">
              Activa. Al ingresar te pedimos, además de la contraseña, el código de tu aplicación autenticadora.
            </p>
            <DesactivarSegundoFactor />
          </>
        ) : (
          <>
            <p className="text-[0.9375rem] text-gris-800">
              No está activa: para entrar basta tu contraseña. Si la activas, al ingresar te pediremos también un código de una
              aplicación autenticadora en tu celular (Google Authenticator, Microsoft Authenticator u otra). Protege mejor los datos de
              los pacientes.
            </p>
            <ActivarSegundoFactor />
          </>
        )}
      </section>
    </div>
  );
}
