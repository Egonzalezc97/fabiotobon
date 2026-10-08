# Notas para la fase 3 (no construido en la fase 2)

## Confirmación al celular registrado cuando un documento reserva desde otro celular

Hoy (fase 2): si una reserva web usa un documento que ya existe pero desde otro celular, la cita se crea sin tocar la ficha y queda marcada para revisión de Fabio (`cita.revision = 'documento_con_otro_celular'`).

En la fase 3, con el emisor real de mensajes:

1. Enviar una confirmación al celular registrado en la ficha del documento.
2. Si la persona confirma, se vincula automáticamente con `resolverRevisionVinculando` (la misma función que usa el panel): el consentimiento, que hasta entonces está ligado solo a la cita con los datos de quien lo aceptó, pasa a la ficha; la revisión se resuelve y queda evento en el historial.
3. Si no confirma dentro de un plazo configurable (DPF), la cita sigue en revisión de Fabio.

Pendiente de definir con Fabio: el plazo, el texto de la plantilla (requiere aprobación de Meta) y qué pasa con la cita si el titular responde que no fue él.

## Otros pendientes que la fase 2 deja preparados

- Emisor real del código de verificación (WhatsApp vía Twilio o correo) implementando `EmisorCodigo` en `src/lib/verificacion`. Hasta entonces, en producción la reserva pública está desactivada.
- Confirmación y recordatorios de cita; aviso a Fabio de reservas nuevas (hoy lo cubre el indicador "Por revisar" del panel).
- Avisar al paciente cuando Fabio cancela o mueve su cita (hoy el panel le recuerda hacerlo a mano).

## Agente de WhatsApp (fase 5)

- **Urgencias**: si un mensaje trae señales de urgencia (propuesta por validar con Fabio: dolor intenso, sangrado, golpe o diente partido, inflamación de la cara, fiebre con dolor dental), el agente:
  1. Alerta a Fabio **de inmediato, a cualquier hora**, sin esperar el resumen ni el horario de atención. El canal de esa alerta sigue pendiente (DPF, propuesta §16, pregunta 18).
  2. Responde al paciente con el número de urgencias de Configuración (`urgencias_telefono`, hoy +57 323 345 6845) y el botón o enlace para llamar. No diagnostica ni recomienda tratamiento (CLAUDE.md).
  3. Si la franja de urgencias está apagada en Configuración, no ofrece atención 24 horas: escala a Fabio y responde con el WhatsApp del consultorio.
  - DECISIÓN PENDIENTE DE FABIO: la lista de señales y el texto de la respuesta, antes de activar el agente.
- **Cómo llegar**: el agente explica la ubicación con la dirección, la ciudad y la **referencia de ubicación** de Configuración (`contacto_referencia`, hoy "Sobre la avenida Santander, al lado de Coldeportes"), más el enlace "Cómo llegar". Solo afirma lo que devuelve la herramienta de contacto.
- Las plantillas de mensajes de la fase 3 (confirmación, recordatorios, reprogramación) incluyen la dirección **con la referencia de ubicación**.
