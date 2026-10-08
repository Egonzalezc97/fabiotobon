// Uso: npm run usuario:reiniciar-2fa -- --usuario ftobonc
// Borra el segundo factor de la cuenta, cierra sus sesiones y deja registro en auditoría.
// Respaldo por consola: lo normal es hacerlo desde Panel → Usuarios.
import { reiniciarSegundoFactor } from "../src/lib/auth/usuarios";
import { cerrarDb, db } from "../src/lib/db";
import { argumento, preguntar } from "./consola";

try {
  const usuario = argumento("usuario") ?? (await preguntar("Nombre de usuario: "));
  const motivo = await preguntar("Motivo (queda en auditoría, sin datos de pacientes): ");
  const confirmacion = await preguntar(`Escribe el nombre de usuario otra vez para confirmar el reinicio de ${usuario}: `);
  if (confirmacion.trim().toLowerCase() !== usuario.trim().toLowerCase()) throw new Error("No coincide. No se hizo nada.");
  await reiniciarSegundoFactor(db(), { usuario, motivo });
  console.log("Segundo factor reiniciado y sesiones cerradas. Al ingresar se le pedirá activarlo de nuevo.");
} catch (error) {
  console.error((error as Error).message);
  process.exitCode = 1;
} finally {
  await cerrarDb();
}
