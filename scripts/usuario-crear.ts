// Uso: npm run usuario:crear -- --correo fabio@ejemplo.com --nombre "Fabio Tobón"
import { auth } from "../src/lib/auth";
import { crearUsuarioAdmin } from "../src/lib/auth/usuarios";
import { cerrarDb, db } from "../src/lib/db";
import { argumento, pedirContrasenaNueva, preguntar } from "./consola";

try {
  const correo = argumento("correo") ?? (await preguntar("Correo: "));
  const nombre = argumento("nombre") ?? (await preguntar("Nombre: "));
  const contrasena = await pedirContrasenaNueva();
  const { userId } = await crearUsuarioAdmin(auth(), db(), { correo, nombre, contrasena });
  console.log(`Usuario creado (${userId}). Al primer ingreso se le pedirá activar la verificación en dos pasos.`);
} catch (error) {
  console.error((error as Error).message);
  process.exitCode = 1;
} finally {
  await cerrarDb();
}
