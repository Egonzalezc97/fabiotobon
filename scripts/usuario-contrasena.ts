// Uso: npm run usuario:contrasena -- --usuario ftobonc
// Cambia la contraseña y cierra todas las sesiones abiertas de esa cuenta.
import { auth } from "../src/lib/auth";
import { cambiarContrasena } from "../src/lib/auth/usuarios";
import { cerrarDb, db } from "../src/lib/db";
import { argumento, pedirContrasenaNueva, preguntar } from "./consola";

try {
  const usuario = argumento("usuario") ?? (await preguntar("Nombre de usuario: "));
  const contrasena = await pedirContrasenaNueva();
  await cambiarContrasena(auth(), db(), { usuario, contrasena });
  console.log("Contraseña cambiada. Se cerraron las sesiones abiertas de esa cuenta.");
} catch (error) {
  console.error((error as Error).message);
  process.exitCode = 1;
} finally {
  await cerrarDb();
}
