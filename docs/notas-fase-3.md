# Notas para la fase 3 (no construido en la fase 2)

## Confirmación al celular registrado cuando un documento reserva desde otro celular

Hoy (fase 2): si una reserva web usa un documento que ya existe pero desde otro celular, la cita se crea sin tocar la ficha y queda marcada para revisión de Fabio (`cita.revision = 'documento_con_otro_celular'`).

En la fase 3, con el emisor real de mensajes:

1. Enviar una confirmación al celular registrado en la ficha del documento.
2. Si la persona confirma, se vincula automáticamente: la marca de revisión se resuelve y queda evento en el historial.
3. Si no confirma dentro de un plazo configurable (DPF), la cita sigue en revisión de Fabio.

Pendiente de definir con Fabio: el plazo, el texto de la plantilla (requiere aprobación de Meta) y qué pasa con la cita si el titular responde que no fue él.

## Otros pendientes que la fase 2 deja preparados

- Emisor real del código de verificación (WhatsApp vía Twilio o correo) implementando `EmisorCodigo` en `src/lib/verificacion`. Hasta entonces, en producción la reserva pública está desactivada.
- Confirmación y recordatorios de cita; aviso a Fabio de reservas nuevas (hoy lo cubre el indicador "Por revisar" del panel).
- Avisar al paciente cuando Fabio cancela o mueve su cita (hoy el panel le recuerda hacerlo a mano).
