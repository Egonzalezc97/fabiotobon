"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { BotonPrincipal, Campo, MensajeError } from "@/components/campo";
import { authCliente } from "@/lib/auth/cliente";

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
    const { data, error } = await authCliente.signIn.email({
      email: String(datos.get("correo")),
      password: String(datos.get("contrasena")),
    });
    setCargando(false);
    if (error) {
      setError(mensajeDeError(error.status, "Correo o contraseña incorrectos."));
      return;
    }
    if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) {
      setPaso("codigo");
      return;
    }
    // Sin segundo factor activado todavía: el panel lo redirige a activarlo.
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
      <form onSubmit={enviarCredenciales} className="mt-8 space-y-5">
        <Campo etiqueta="Correo" id="correo" name="correo" type="email" autoComplete="username" required />
        <Campo
          etiqueta="Contraseña"
          id="contrasena"
          name="contrasena"
          type="password"
          autoComplete="current-password"
          required
        />
        <MensajeError mensaje={error} />
        <BotonPrincipal cargando={cargando}>{cargando ? "Verificando…" : "Continuar"}</BotonPrincipal>
      </form>
    );
  }

  return (
    <form onSubmit={enviarCodigo} className="mt-8 space-y-5" key={paso}>
      <p className="text-sm text-tinta-suave">
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
      <BotonPrincipal cargando={cargando}>{cargando ? "Verificando…" : "Ingresar"}</BotonPrincipal>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setPaso(paso === "codigo" ? "respaldo" : "codigo");
        }}
        className="text-sm text-tinta-suave underline underline-offset-4 hover:text-tinta"
      >
        {paso === "codigo" ? "Usar un código de respaldo" : "Usar la aplicación autenticadora"}
      </button>
    </form>
  );
}
