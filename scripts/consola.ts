import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";

export function argumento(nombre: string): string | undefined {
  const i = process.argv.indexOf(`--${nombre}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

export async function preguntar(texto: string): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    return (await rl.question(texto)).trim();
  } finally {
    rl.close();
  }
}

/** Pide una contraseña sin mostrarla en pantalla. */
export async function preguntarOculto(texto: string): Promise<string> {
  if (!stdin.isTTY) throw new Error("Ejecuta este comando en una terminal interactiva.");
  stdout.write(texto);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");
  return new Promise((resolve, reject) => {
    let valor = "";
    const alTeclear = (tecla: string) => {
      for (const c of tecla) {
        if (c === "\r" || c === "\n") {
          terminar();
          stdout.write("\n");
          resolve(valor);
          return;
        }
        if (c === "\u0003") {
          terminar();
          reject(new Error("Cancelado."));
          return;
        }
        if (c === "\u007f" || c === "\b") valor = valor.slice(0, -1);
        else valor += c;
      }
    };
    const terminar = () => {
      stdin.off("data", alTeclear);
      stdin.setRawMode(false);
      stdin.pause();
    };
    stdin.on("data", alTeclear);
  });
}

export async function pedirContrasenaNueva(): Promise<string> {
  const primera = await preguntarOculto("Contraseña (mínimo 12 caracteres): ");
  const segunda = await preguntarOculto("Repite la contraseña: ");
  if (primera !== segunda) throw new Error("Las contraseñas no coinciden.");
  return primera;
}
