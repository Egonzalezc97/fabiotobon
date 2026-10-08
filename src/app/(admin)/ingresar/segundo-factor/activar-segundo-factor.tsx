"use client";

import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { useState, type FormEvent } from "react";
import { BotonPrincipal, Campo, MensajeError } from "@/components/campo";
import { authCliente } from "@/lib/auth/cliente";

type Configuracion = { qr: string; secreto: string; codigosRespaldo: string[] };

export function ActivarSegundoFactor() {
  const router = useRouter();
  const [config, setConfig] = useState<Configuracion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function iniciar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const contrasena = String(new FormData(evento.currentTarget).get("contrasena"));
    setCargando(true);
    setError(null);
    const { data, error } = await authCliente.twoFactor.enable({ password: contrasena, method: "totp" });
    if (error || !data || data.method !== "totp") {
      setCargando(false);
      setError(error?.status === 429 ? "Demasiados intentos. Espera unos minutos." : "Contraseña incorrecta.");
      return;
    }
    const qr = await QRCode.toDataURL(data.totpURI, { margin: 1, width: 220 });
    const secreto = new URL(data.totpURI).searchParams.get("secret") ?? "";
    setConfig({ qr, secreto, codigosRespaldo: data.backupCodes });
    setCargando(false);
  }

  async function confirmar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const codigo = String(new FormData(evento.currentTarget).get("codigo")).replace(/\s/g, "");
    setCargando(true);
    setError(null);
    const { error } = await authCliente.twoFactor.verifyTotp({ code: codigo, trustDevice: false });
    setCargando(false);
    if (error) {
      setError("El código no coincide. Revisa la hora del celular y vuelve a intentarlo.");
      return;
    }
    router.replace("/admin");
    router.refresh();
  }

  if (!config) {
    return (
      <form method="post" onSubmit={iniciar} className="mt-8 space-y-5">
        <Campo
          etiqueta="Confirma tu contraseña"
          id="contrasena"
          name="contrasena"
          type="password"
          autoComplete="current-password"
          required
        />
        <MensajeError mensaje={error} />
        <BotonPrincipal cargando={cargando}>{cargando ? "Preparando…" : "Continuar"}</BotonPrincipal>
      </form>
    );
  }

  return (
    <div className="mt-8 space-y-8">
      <section className="space-y-3">
        <h2 className="font-medium">1. Escanea este código con la aplicación</h2>
        {/* eslint-disable-next-line @next/next/no-img-element -- imagen generada en el navegador (data URL) */}
        <img src={config.qr} alt="Código QR para la aplicación autenticadora" width={220} height={220} />
        <p className="text-sm text-gris-600">
          Si no puedes escanearlo, escribe esta clave en la aplicación:{" "}
          <code className="break-all font-mono text-gris-800">{config.secreto}</code>
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-medium">2. Guarda tus códigos de respaldo</h2>
        <p className="text-sm text-gris-600">
          Te permiten entrar si pierdes el celular. Cada uno sirve una vez. Guárdalos fuera de este equipo; no se
          vuelven a mostrar.
        </p>
        <ul className="grid grid-cols-2 gap-2 rounded-[2px] border border-gris-200 bg-papel p-4 font-mono text-sm">
          {config.codigosRespaldo.map((codigo) => (
            <li key={codigo}>{codigo}</li>
          ))}
        </ul>
      </section>

      <form method="post" onSubmit={confirmar} className="space-y-5">
        <h2 className="font-medium">3. Escribe el código que muestra la aplicación</h2>
        <Campo etiqueta="Código" id="codigo" name="codigo" inputMode="numeric" autoComplete="one-time-code" required />
        <MensajeError mensaje={error} />
        <BotonPrincipal cargando={cargando}>{cargando ? "Verificando…" : "Activar y entrar"}</BotonPrincipal>
      </form>
    </div>
  );
}
