# Encargo: usuarios del panel y fase 4 (CRM, tratamientos y abonos, galería)

Lee de nuevo `CLAUDE.md`, `docs/brief.md` (§5–§7), `docs/propuesta-tecnica.md` (§11, §14 y los anexos del 2026-10-08) y `docs/notas-fase-3.md`.

Orden acordado del resto del proyecto: (1) este encargo, (2) fase 3 de notificaciones por correo con el canal WhatsApp desconectado, (3) base de historia clínica, (4) despliegue de pruebas en Railway, (5) agente de WhatsApp al final, cuando Fabio entregue el cuestionario.

## Parte A · Usuarios del panel

- Cuentas **individuales**, nunca compartidas: cada persona con su correo, su contraseña y su segundo factor. La auditoría debe decir quién hizo qué.
- Roles:
  - `admin`: todo, incluida la gestión de usuarios.
  - `asistente`: agenda, pacientes, tratamientos y abonos. Sin historia clínica (cuando exista), sin configuración y sin usuarios.
- Panel → Usuarios (solo admin): crear usuario (nombre, correo, rol), desactivar (nunca borrar), cambiar rol, reiniciar el segundo factor y forzar cambio de contraseña. Cada acción queda en auditoría.
- Alta sin correo saliente (aún no hay): el admin define una contraseña temporal; en el primer ingreso el usuario debe cambiarla y activar su segundo factor.
- Un admin no puede quitarse a sí mismo el rol ni desactivarse si es el único admin activo.
- Los scripts de consola se mantienen como respaldo.
- Prueba que recorre las rutas y acciones del panel: además de exigir sesión, verifica el rol requerido.

## Parte B · Fase 4

### Ficha completa del paciente
- Datos personales del brief §7: nombre, documento, teléfono, WhatsApp, correo, fecha de nacimiento, notas administrativas. Sin campos clínicos.
- Pestañas: datos, citas (próximas, anteriores, canceladas, reprogramadas), tratamientos y abonos, consentimientos, historial de cambios.
- Edición con auditoría. Fusión de fichas duplicadas (revisión de identidad de la fase 2): elegir la ficha que queda, mover citas, tratamientos y consentimientos, y dejar evento. Solo admin.

### Tabla de pacientes (CRM)
- Columnas del brief §6: paciente, documento, estado, estado de pago, próxima cita. Además, saldo pendiente.
- Búsqueda por nombre, documento o celular; filtros por estado, estado de pago y "con cita próxima"; orden por columna; paginación en el servidor.
- En celular, tarjetas en lugar de tabla.

### Tratamientos y abonos (ver anexo "Control de pagos por paciente" en la propuesta)
- `tratamiento`: paciente, servicio o descripción, costo total acordado, estado (presupuestado, en curso, terminado, cancelado), fechas y notas.
- `abono`: tratamiento, valor, fecha, medio (efectivo, transferencia, tarjeta, otro), referencia y quién lo registró. **No se borra**: se anula con motivo.
- Los cambios del costo total quedan como evento con valor anterior, valor nuevo y motivo.
- Calculado, nunca guardado: total abonado, saldo y estado de pago (saldado, con saldo, sin abonos). Una restricción impide que la suma de abonos vigentes supere el costo total, salvo confirmación explícita (saldo a favor).
- Valores en pesos colombianos, enteros, sin decimales.
- DPF: cuotas con fechas de pago y estado "en mora". No construir ahora; el modelo no debe impedirlo.
- Panel → Inicio: resumen de cartera (total por cobrar, pacientes con saldo, abonos del mes).

### Galería de antes y después administrable
- Subida de fotos desde el panel, solo admin: caso con procedimiento, imagen de antes, imagen de después, descripción corta y estado (borrador o publicado).
- **No se puede publicar un caso sin un consentimiento de uso de imagen vinculado**: paciente, fecha y archivo del documento firmado, o marca explícita "autorización escrita en físico", con quién la verificó.
- Al subir: quitar metadatos EXIF y GPS, generar versiones optimizadas y guardar el original en almacenamiento privado. Las versiones públicas solo existen para casos publicados; al despublicar se retiran.
- Almacenamiento: en local, carpeta ignorada por git; para producción, interfaz con implementación compatible con S3 (Railway o similar). Propón la opción.
- La sección pública lee los casos publicados; sin casos, se mantiene el contenido de demostración y la cinta.

## Fuera de este encargo
Notificaciones, historia clínica, despliegue y agente de WhatsApp (siguen en ese orden después).

## Forma de trabajo
1. Preséntame el plan (migraciones, pantallas, almacenamiento de imágenes, librerías nuevas) y espera aprobación.
2. Commits pequeños. Al terminar: pruebas y CI en verde, semilla de demostración con tratamientos, abonos y un caso de galería ficticio, sitio en local, commit, push e informe con DPF y riesgos.
