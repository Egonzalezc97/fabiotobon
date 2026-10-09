// Uso: npm run usuario:crear -- --nombre "Fabio Tobón Casas" [--usuario ftobonc] [--correo fabio@ejemplo.com] [--rol admin|asistente]
// Respaldo por consola: lo normal es crear usuarios desde Panel → Usuarios.
import { auth } from "../src/lib/auth";
import { crearUsuario, nombreUsuarioDisponible, sugerirNombreUsuario, type Rol } from "../src/lib/auth/usuarios";
import { cerrarDb, db } from "../src/lib/db";
import { argumento, pedirContrasenaNueva, preguntar } from "./consola";

try {
  const nombre = argumento("nombre") ?? (await preguntar("Nombre completo: "));
  const sugerido = await nombreUsuarioDisponible(db(), sugerirNombreUsuario(nombre));
  const usuario = argumento("usuario") ?? ((await preguntar(`Nombre de usuario [${sugerido}]: `)) || sugerido);
  const correo = argumento("correo") ?? (await preguntar("Correo (opcional, recomendado para recuperar la contraseña): "));
  const rol = (argumento("rol") ?? "admin") as Rol;
  const contrasena = await pedirContrasenaNueva();
  const { userId } = await crearUsuario(auth(), db(), { nombre, usuario, correo, rol, contrasena, temporal: false }, null);
  console.log(`Usuario "${usuario.toLowerCase()}" creado (${userId}). Ingresa con su nombre de usuario y contraseña; si quiere, puede activar la verificación en dos pasos en Mi cuenta.`);
} catch (error) {
  console.error((error as Error).message);
  process.exitCode = 1;
} finally {
  await cerrarDb();
}
