-- 0011 · Especialidad, dirección, redes y urgencias de Fabio.
-- Datos REALES entregados por Fabio (no son contenido de demostración).
-- Se editan desde el panel (Configuración → Datos de contacto). No pisan valores ya guardados.

INSERT INTO configuracion (clave, valor, descripcion) VALUES
  ('especialidad', '"Odontología integral"', 'Especialidad: etiqueta del encabezado y título del sitio'),
  ('contacto_direccion', '"Carrera 23 N.º 47-80"', 'Dirección del consultorio'),
  ('contacto_ciudad', '"Manizales"', 'Ciudad del consultorio'),
  ('contacto_referencia', '"Sobre la avenida Santander, al lado de Coldeportes"',
   'Referencia para llegar; la usan el sitio, los mensajes y el agente'),
  ('redes_instagram', '"https://instagram.com/dr.fabiotobon"', 'Perfil de Instagram'),
  ('redes_facebook', '"https://facebook.com/dr.fabiotobon"', 'Página de Facebook'),
  ('urgencias_activa', 'true', 'Muestra la franja de urgencias en el sitio'),
  ('urgencias_texto', '"Urgencias 24 horas"', 'Texto de la franja de urgencias'),
  ('urgencias_telefono', '"+573233456845"', 'Número de llamada para urgencias, con indicativo de país')
ON CONFLICT (clave) DO NOTHING;
