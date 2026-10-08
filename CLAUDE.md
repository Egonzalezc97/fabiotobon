# Fabio Tobón Odontología — plataforma digital

Landing pública, panel privado (agenda, CRM, historia clínica) y agente de WhatsApp para el odontólogo Fabio Tobón. Un solo sistema, un solo odontólogo, una sola agenda.

## Documentos que mandan

1. `docs/brief.md` — **especificación funcional. Es lo que se construye.**
2. `docs/propuesta-tecnica.md` — arquitectura aprobada, modelo de datos, flujos, fases y preguntas abiertas.

Si el código y estos documentos se contradicen, se corrige uno de los dos de forma explícita; no se improvisa.

## Reglas no negociables

- **No inventar decisiones de negocio.** Si algo no está definido, se marca `DECISIÓN PENDIENTE DE FABIO` (o `DPA` si es de Altreon), se proponen alternativas y se deja configurable. Nunca se rellena con un supuesto.
- **Contenido de demostración, nunca presentado como real.** Fabio aún no ha entregado contenido, así que se trabaja con datos ficticios bajo estas condiciones:
  - Todo vive en `db/seed/demo.sql` (y textos en `src/content/demo`), separado del código. Nada ficticio escrito a mano dentro de componentes.
  - Con `DEMO_CONTENT=true` el sitio muestra una cinta visible "Contenido de demostración". El despliegue de producción falla si esa variable está activa.
  - Servicios, descripciones, duraciones, horarios y precios: ficticios pero verosímiles, redactados desde cero. No copiar textos de sitios de otros odontólogos.
  - Antes y después: imágenes de relleno neutras. Nunca fotos de pacientes de otros consultorios.
  - **Sin testimonios, reseñas, calificaciones ni cifras de trayectoria** ("+15 años", "+3.000 pacientes"), ni siquiera de demostración. El brief no pide esas secciones.
  - Dirección, teléfono, registro profesional: marcadores `[PENDIENTE: ...]`.
- **No definir campos clínicos** de la historia clínica sin validación de Fabio.
- **Una sola entidad de cita.** Landing, panel y WhatsApp crean, mueven y cancelan citas a través de las mismas funciones de `src/modules/agenda`. Prohibido un segundo camino de escritura.
- **Reglas de negocio en datos, no en código**: duraciones, horarios, políticas de cancelación y servicios se leen de la base de datos.
- **El público nunca ve el motivo de un bloqueo** ni recibe respuestas distintas según si un teléfono o documento pertenece a un paciente.
- **El agente solo afirma lo que devuelven sus herramientas.** Sin diagnósticos, sin recomendaciones de tratamiento, sin promesas de resultado.
- **Datos de salud**: nada de datos reales de pacientes en el repositorio, en semillas, en registros ni en pruebas. Secretos solo en variables de entorno.

## Fuera de alcance

Pasarela de pagos, cotizaciones, reactivación proactiva de pacientes, multiusuario o varios doctores, sincronización con Google Calendar, facturación electrónica, multi-tenant, y que el agente agende dentro del chat (entrega el enlace de reserva).

## Stack

- Next.js (App Router) + TypeScript estricto, una sola aplicación.
- PostgreSQL. Migraciones SQL versionadas en `db/migrations`.
- Tailwind + componentes propios. Sin plantillas de clínica dental.
- WhatsApp vía Twilio, detrás de una interfaz propia en `src/lib/whatsapp`.
- Agente con Claude vía API y uso de herramientas.
- Notificaciones: tabla outbox + tarea programada. Sin n8n ni colas externas.
- Despliegue previsto: Railway (aplicación + PostgreSQL).

## Estructura

```
src/app/(public)/     landing y reserva
src/app/(admin)/      panel privado
src/app/api/          webhooks y tareas programadas
src/modules/          dominio: agenda, pacientes, servicios, notificaciones, galeria, agente, auditoria
src/components/       UI compartida
src/lib/              clientes de BD, WhatsApp, correo, LLM
public/brand/         logos SVG (usan currentColor)
```

`app/` no contiene reglas de negocio. `modules/` no importa nada de `app/`.

## Agenda: invariantes

- Los cupos se calculan (horario − bloqueos − citas activas); no se almacenan.
- El no-solapamiento lo garantiza una restricción de exclusión en PostgreSQL, no una verificación previa en código.
- Zona horaria única `America/Bogota`; se guarda en UTC.
- Las citas no se borran: cambian de estado y dejan evento en el historial.
- Reprogramar actualiza la misma cita en una transacción.

## Marca y diseño

- Logos en `public/brand/`: `isotipo`, `diente` (favicon), `wordmark`, `logo-completo`, `texto-doctor`, `texto-nombre`. Son calcos de un JPEG: bien a tamaño de cabecera, irregulares si se amplían mucho.
- Grises, azul como acento, blanco, espacios amplios. Premium y limpio, cercano, no corporativo.
- Móvil primero. Botón de WhatsApp visible en toda la experiencia pública.

## Forma de trabajo

- Avanzar por las fases de `docs/propuesta-tecnica.md` §17, en orden. No adelantar módulos de fases posteriores.
- Antes de implementar algo no trivial: explicar el problema, la solución y los riesgos; después el código.
- Pruebas automatizadas obligatorias para disponibilidad, creación, cancelación y reprogramación de citas, incluidos los casos de concurrencia.
- Seguridad dentro de cada fase, no al final: autorización en servidor, validación de entradas, auditoría de accesos a datos sensibles.
- Señalar la sobreingeniería y las contradicciones con el brief en cuanto aparezcan.
- Todo el texto visible al usuario en español de Colombia.
