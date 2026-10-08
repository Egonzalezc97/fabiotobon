// Sin dependencias: lo importan next.config.ts y la instrumentación del servidor.

type Variables = Record<string, string | undefined>;

/** Producción si así lo declara APP_ENV o si Railway reporta su entorno "production". */
export function esProduccion(variables: Variables): boolean {
  return variables.APP_ENV === "production" || variables.RAILWAY_ENVIRONMENT_NAME === "production";
}

export function contenidoDemoActivo(variables: Variables): boolean {
  return variables.DEMO_CONTENT === "true";
}

/**
 * Regla de CLAUDE.md: el contenido de demostración nunca llega a producción.
 * Se llama al compilar (next.config.ts) y al arrancar el servidor (instrumentation.ts).
 */
export function verificarDespliegue(variables: Variables): void {
  if (esProduccion(variables) && contenidoDemoActivo(variables)) {
    throw new Error(
      "Despliegue bloqueado: DEMO_CONTENT=true en producción. El contenido de demostración no puede publicarse.",
    );
  }
}
