// Se ejecuta una vez al arrancar el servidor de Next.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { verificarArranque } = await import("./instrumentation-node");
    await verificarArranque();
  }
}
