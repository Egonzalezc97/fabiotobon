-- 0005 · WhatsApp real de Fabio y mensaje inicial de los botones de WhatsApp.
-- Dato REAL entregado por Fabio el 2026-10-08 (no es contenido de demostración).
-- Se edita desde el panel (Configuración → Datos de contacto). No pisa valores ya guardados.

INSERT INTO configuracion (clave, valor, descripcion) VALUES
  ('contacto_whatsapp', '"+573233456845"', 'WhatsApp del consultorio, con indicativo de país'),
  ('contacto_whatsapp_mensaje', '"Hola, quiero información para agendar una valoración."',
   'Mensaje inicial que se escribe solo al abrir WhatsApp desde el sitio')
ON CONFLICT (clave) DO NOTHING;
