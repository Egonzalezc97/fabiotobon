// Uso: npm run usuario:reiniciar-2fa -- --correo fabio@ejemplo.com
// Borra el segundo factor de la cuenta, cierra sus sesiones y deja registro en auditoría.
// Solo por consola: exige acceso al servidor y a las variables de entorno de producción.
import { auth } from "../src/lib/auth";
import { reiniciarSegundoFactor } from "../src/lib/auth/usuarios";
import { cerrarDb, db } from "../src/lib/db";
import { argumento, preguntar } from "./consola";

try {
  const correo = argumento("correo") ?? (await preguntar("Correo de la cuenta: "));
  const motivo = await preguntar("Motivo (queda en auditoría, sin datos de pacientes): ");
  const confirmacion = await preguntar(`Escribe el correo otra vez para confirmar el reinicio de ${correo}: `);
  if (confirmacion.trim().toLowerCase() !== correo.trim().toLowerCase()) throw new Error("No coincide. No se hizo nada.");
  await reiniciarSegundoFactor(auth(), db(), { correo, motivo });
  console.log("Segundo factor reiniciado y sesiones cerradas. Al ingresar se le pedirá activarlo de nuevo.");
} catch (error) {
  console.error((error as Error).message);
  process.exitCode = 1;
} finally {
  await cerrarDb();
}
