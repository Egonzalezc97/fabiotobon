import { z } from "zod";

const esquema = z.object({
  APP_ENV: z.enum(["development", "production"]).default("development"),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET debe tener al menos 32 caracteres"),
  BETTER_AUTH_URL: z.url(),
});

export type Env = z.infer<typeof esquema>;

let cache: Env | undefined;

/**
 * Variables de entorno validadas. Se leen al primer uso, no al importar,
 * para que `next build` no exija secretos que solo hacen falta en ejecución.
 */
export function env(): Env {
  if (!cache) {
    const resultado = esquema.safeParse(process.env);
    if (!resultado.success) {
      const detalle = resultado.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      throw new Error(`Variables de entorno inválidas: ${detalle}`);
    }
    cache = resultado.data;
  }
  return cache;
}
