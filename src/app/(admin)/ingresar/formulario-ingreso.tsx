"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { BotonPrincipal, Campo, MensajeError } from "@/components/campo";
import { authCliente } from "@/lib/auth/cliente";
import { TituloAcceso } from "./titulo-acceso";

type Paso = "credenciales" | "codigo" | "respaldo";

function mensajeDeError(status: number | undefined, porDefecto: string) {
  if (status === 429) return "Demasiados intentos. Espera unos minutos y vuelve a intentarlo.";
  return porDefecto;
}

export function FormularioIngreso() {
  const router = useRouter();
  const [paso, setPaso] = useState<Paso>("credenciales");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  function entrar() {
    router.replace("/admin");
    router.refresh();
  }

  async function enviarCredenciales(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    setCargando(true);
    setError(null);
    const { data, error } = await authCliente.signIn.username({
      username: String(datos.get("usuario")).trim(),
      password: String(datos.get("contrasena")),
    });
    setCargando(false);
    if (error) {
      setError(mensajeDeError(error.status, "Usuario o contraseña incorrectos."));
      return;
    }
    if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) {
      setPaso("codigo");
      return;
    }
    // Sin segundo factor (es opcional): la contraseña basta.
    entrar();
  }

  async function enviarCodigo(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const codigo = String(new FormData(evento.currentTarget).get("codigo")).replace(/\s/g, "");
    setCargando(true);
    setError(null);
    const { error } =
      paso === "codigo"
        ? await authCliente.twoFactor.verifyTotp({ code: codigo, trustDevice: false })
        : await authCliente.twoFactor.verifyBackupCode({ code: codigo, trustDevice: false });
    setCargando(false);
    if (error) {
      setError(mensajeDeError(error.status, "El código no es válido o ya venció."));
      return;
    }
    entrar();
  }

  if (paso === "credenciales") {
    return (
      <form method="post" onSubmit={enviarCredenciales} className="space-y-5" noValidate>
        <TituloAcceso>Ingresar</TituloAcceso>
        <Campo
          etiqueta="Usuario"
          id="usuario"
          name="usuario"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
        />
        <Campo
          etiqueta="Contraseña"
          id="contrasena"
          name="contrasena"
          type="password"
          autoComplete="current-password"
          required
        />
        <MensajeError mensaje={error} />
        <BotonPrincipal cargando={cargando}>{cargando ? "Verificando…" : "Ingresar"}</BotonPrincipal>
      </form>
    );
  }

  return (
    <form method="post" onSubmit={enviarCodigo} className="space-y-5" key={paso}>
      <TituloAcceso>{paso === "codigo" ? "Código de verificación" : "Código de respaldo"}</TituloAcceso>
      <p className="font-sans text-sm text-gris-600">
        {paso === "codigo"
          ? "Escribe el código de seis dígitos de tu aplicación autenticadora."
          : "Escribe uno de tus códigos de respaldo. Cada código sirve una sola vez."}
      </p>
      <Campo
        etiqueta={paso === "codigo" ? "Código" : "Código de respaldo"}
        id="codigo"
        name="codigo"
        inputMode={paso === "codigo" ? "numeric" : "text"}
        autoComplete="one-time-code"
        autoFocus
        required
      />
      <MensajeError mensaje={error} />
      <BotonPrincipal cargando={cargando}>{cargando ? "Verificando…" : "Entrar al panel"}</BotonPrincipal>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setPaso(paso === "codigo" ? "respaldo" : "codigo");
        }}
        className="min-h-11 font-sans text-sm text-gris-600 underline underline-offset-4 hover:text-gris-800"
      >
        {paso === "codigo" ? "Usar un código de respaldo" : "Usar la aplicación autenticadora"}
      </button>
    </form>
  );
}
