# Encargo: fase 2 (agenda y reserva en línea)

Lee de nuevo `CLAUDE.md`, `docs/brief.md` (§3, §4, §8, §9) y `docs/propuesta-tecnica.md` (§4–6, §7, §10, §14) antes de empezar.

Objetivo: que Fabio pueda manejar su agenda desde el panel y que un paciente nuevo pueda reservar su valoración desde la web. Es el núcleo del producto: prioriza que sea correcto antes que completo.

## Alcance

### Modelo de datos (migraciones nuevas, sin tocar las anteriores)

- `paciente`: ficha mínima. Nombre, celular en E.164 (único y verificado), correo opcional, estado, notas, fechas. El resto de la ficha llega en la fase 4.
- `cita`: paciente, servicio, inicio, fin, estado (pendiente, confirmada, cancelada, cumplida, no_asistio), origen (web, panel, whatsapp), notas internas.
- `cita_evento`: historial de cada cita (creada, reprogramada con horario anterior y nuevo, cancelada, cambio de estado), con actor.
- `bloqueo`: inicio, fin, día completo, motivo privado.
- Consentimiento de tratamiento de datos: registrar qué texto aceptó el paciente y cuándo.
- **No-solapamiento garantizado por PostgreSQL** con una restricción de exclusión sobre las citas activas. Nada de "verificar y luego insertar".

### Cálculo de disponibilidad

- Los cupos se calculan, no se guardan: horario laboral − bloqueos − citas activas, partido según la duración del servicio.
- Parámetros en `configuracion`, editables desde el panel: granularidad de cupos, antelación mínima, horizonte de reserva.
- Zona horaria única `America/Bogota`; se guarda en UTC.
- El público solo ve "disponible". Nunca el motivo de un bloqueo ni qué cita ocupa un espacio.

### Reserva pública (/reservar)

- Solo **Valoración odontológica** para pacientes nuevos. La reserva de pacientes existentes llega en la fase 4.
- Flujo: elige día y hora → nombre, celular, correo opcional → acepta la autorización de datos → verifica el celular con un código → cita creada → pantalla de confirmación.
- **Verificación por código** detrás de una interfaz propia (`src/lib/verificacion`). En esta fase el único emisor es uno de desarrollo que muestra el código en la consola del servidor. El emisor real (WhatsApp vía Twilio o correo) se conecta en la fase 3. En producción, si no hay emisor real configurado, la reserva pública queda desactivada con un mensaje y enlace a WhatsApp.
- Respuesta uniforme: el sistema nunca revela si un celular ya es paciente.
- Límites: intentos de código, solicitudes por IP y por celular, y máximo una valoración futura activa por celular.
- Si el cupo se ocupa mientras el paciente llenaba el formulario, se le muestra un mensaje claro y los cupos actualizados.

### Panel

- **Agenda**: vista de día y de semana (mes solo si sale barato). Crear cita para un paciente nuevo o existente, mover, cancelar y cambiar estado. Cada acción deja evento.
  - Escritorio: cuadrícula de semana tipo calendario, con horas en el eje vertical, columnas por día y cada cita como bloque con su altura según la duración (paciente, servicio, estado). Bloqueos y horas fuera del horario se ven en gris.
  - Celular: vista de día como lista cronológica, con navegación por días.
  - Tocar un espacio libre abre "nueva cita" con esa hora; tocar una cita abre su detalle.
  - Arrastrar para mover citas no es obligatorio en esta fase; mover se hace desde el detalle. Propón si vale la pena y su costo.
  - Si propones una librería de calendario, justifica licencia, peso y si permite el diseño propio; si no, construye la cuadrícula.
- **Bloqueos**: bloquear un rango de horas o días completos. **Si el bloqueo choca con citas existentes, no se guarda en silencio**: se listan las citas afectadas y Fabio decide reprogramar o cancelar cada una antes de confirmar.
- **Servicios**: crear, editar y desactivar (nunca borrar). Nombre, descripción, duración, precio, mostrar precio, visible en la landing, quién puede reservarlo y activo.
- **Horario laboral**: editar tramos por día.
- **Pacientes**: búsqueda y ficha mínima, solo lo necesario para agendar. El CRM completo es la fase 4.
- **Configuración**: parámetros de agenda y estado inicial de las citas web.
- Diseñado para usarse desde el celular de Fabio: es donde más lo va a consultar. Mismos tokens visuales de la dirección "Papel y grafito", pero sobrio y funcional.

## Decisiones pendientes de Fabio: valores por defecto

Todas configurables desde el panel, marcadas como DPF en el código y listadas en tu informe final.

| Decisión | Valor por defecto |
|---|---|
| Estado inicial de una cita web | Confirmada |
| Antelación mínima para reservar | 2 horas |
| Horizonte de reserva | 30 días |
| Granularidad de cupos | 15 minutos |
| Datos obligatorios del paciente nuevo | Nombre y celular verificado; correo opcional; documento no se pide |
| Valoraciones futuras activas por celular | 1 |

## Fuera de esta fase

Notificaciones (confirmación, recordatorios), cancelación y reprogramación por el propio paciente, reserva de pacientes existentes, CRM completo, pagos, galería administrable e imágenes reales. La pantalla de confirmación reemplaza por ahora los mensajes.

## Pruebas obligatorias

- Cálculo de cupos: bordes del horario, servicios largos que no caben al final del día, bloqueos parciales y de día completo, antelación y horizonte.
- **Concurrencia**: dos reservas simultáneas del mismo cupo; exactamente una gana.
- Reprogramar dentro de una transacción: si el nuevo horario está ocupado, la cita conserva el horario original.
- Bloqueo sobre citas existentes: no se guarda sin resolver las citas afectadas.
- Respuesta uniforme de la verificación y límites de intentos.
- El público no puede leer motivos de bloqueo ni datos de otras citas.
- Rutas del panel rechazadas sin sesión y sin segundo factor.

## Otros

- Agrega `.claude/settings.local.json` al `.gitignore`.
- Agrega `src/modules/configuracion` a la lista de módulos de `CLAUDE.md`.

## Forma de trabajo

1. Antes de escribir código preséntame el plan: migraciones, flujo de reserva pantalla por pantalla, cómo resuelves la concurrencia y las librerías nuevas que necesites. Espera mi aprobación.
2. Implementa en commits pequeños. Al terminar: pruebas y CI en verde, sitio corriendo en local, commit y push, y un informe con lo hecho, las DPF y los riesgos.
