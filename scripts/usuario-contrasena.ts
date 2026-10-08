// Uso: npm run usuario:contrasena -- --correo fabio@ejemplo.com
// Cambia la contraseña y cierra todas las sesiones abiertas de esa cuenta.
import { auth } from "../src/lib/auth";
import { cambiarContrasena } from "../src/lib/auth/usuarios";
import { cerrarDb, db } from "../src/lib/db";
import { argumento, pedirContrasenaNueva, preguntar } from "./consola";

try {
  const correo = argumento("correo") ?? (await preguntar("Correo: "));
  const contrasena = await pedirContrasenaNueva();
  await cambiarContrasena(auth(), db(), { correo, contrasena });
  console.log("Contraseña cambiada. Se cerraron las sesiones abiertas de esa cuenta.");
} catch (error) {
  console.error((error as Error).message);
  process.exitCode = 1;
} finally {
  await cerrarDb();
}
