-- 0012 · Teléfono de contacto de Fabio.
-- Dato REAL entregado por Fabio (no es contenido de demostración).
-- Se edita desde el panel (Configuración → Datos de contacto). No pisa un valor ya guardado.

INSERT INTO configuracion (clave, valor, descripcion) VALUES
  ('contacto_telefono', '"+57 323 345 6845"', 'Teléfono de contacto; el sitio lo muestra como enlace para llamar')
ON CONFLICT (clave) DO NOTHING;
