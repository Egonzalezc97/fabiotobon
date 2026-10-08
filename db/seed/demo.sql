-- Semilla de DEMOSTRACIÓN. Nada de esto es información real de Fabio Tobón.
-- Servicios, descripciones, duraciones, precios y horario son ficticios, redactados desde cero
-- para poder construir y revisar el sitio. Se reemplazan cuando Fabio entregue los datos reales.
--
-- Se carga con `npm run db:semilla-demo`, que se niega a correr en producción
-- y sobre una base con servicios reales. Marca la base con `contenido_demo = true`:
-- el sitio muestra la cinta de demostración y producción no arranca con esa marca.
--
-- Los datos de contacto y el registro profesional NO se siembran: el sitio muestra "[PENDIENTE: …]".
-- La política de reserva de cada servicio es DECISIÓN PENDIENTE DE FABIO; aquí solo la valoración es pública.

INSERT INTO configuracion (clave, valor, descripcion)
VALUES ('contenido_demo', 'true', 'La base tiene cargada la semilla de demostración')
ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor, descripcion = EXCLUDED.descripcion;

INSERT INTO servicio (slug, nombre, descripcion, duracion_min, precio_cop, mostrar_precio, visible_en_landing, politica_reserva, orden)
VALUES
  ('valoracion-odontologica', 'Valoración odontológica',
   'Revisamos tu boca, resolvemos tus dudas y te explicamos qué opciones tienes y en qué orden.',
   30, 80000, true, true, 'publico', 1),
  ('limpieza-dental', 'Limpieza dental',
   'Retiramos placa y cálculo y pulimos las superficies. Te mostramos qué zonas necesitan más cuidado en casa.',
   45, 150000, true, true, 'solo_admin', 2),
  ('diseno-de-sonrisa', 'Diseño de sonrisa',
   'Planeamos contigo forma, tamaño y proporción de tus dientes antes de intervenir. El plan se define en la valoración.',
   120, 6500000, false, true, 'solo_admin', 3),
  ('blanqueamiento-dental', 'Blanqueamiento dental',
   'Aclaramos el tono de tus dientes en consultorio. Antes revisamos si es adecuado para ti y qué cambio es realista.',
   90, 900000, true, true, 'solo_admin', 4),
  ('carillas', 'Carillas',
   'Láminas delgadas que cubren la cara visible del diente para cambiar su forma o su color.',
   120, 1200000, false, true, 'solo_admin', 5),
  ('rehabilitacion-oral', 'Rehabilitación oral',
   'Un plan por etapas para recuperar la función al masticar cuando faltan dientes o hay varios desgastados.',
   90, NULL, false, true, 'solo_admin', 6),
  ('implantes-dentales', 'Implantes dentales',
   'Reemplazo de un diente perdido con una raíz artificial y una corona. Primero estudiamos el hueso disponible.',
   90, 4200000, false, true, 'solo_admin', 7),
  ('coronas', 'Coronas',
   'Una funda hecha a la medida que cubre y protege un diente debilitado o muy restaurado.',
   60, 1100000, false, true, 'solo_admin', 8),
  ('endodoncia', 'Endodoncia',
   'Tratamiento del nervio del diente para conservarlo cuando está inflamado o infectado.',
   90, 650000, false, true, 'solo_admin', 9),
  ('ortodoncia', 'Ortodoncia',
   'Alineamos tus dientes con brackets o alineadores. La opción se elige después de estudiar tu caso.',
   45, NULL, false, true, 'solo_admin', 10),
  ('restauraciones', 'Restauraciones',
   'Reparamos caries o fracturas pequeñas con resina del color de tu diente.',
   60, 180000, true, true, 'solo_admin', 11),
  ('extracciones', 'Extracciones',
   'Retiramos un diente cuando no es posible conservarlo, con anestesia local e indicaciones claras para después.',
   45, 200000, false, true, 'solo_admin', 12),
  ('periodoncia', 'Periodoncia',
   'Atención de las encías cuando sangran, se inflaman o se retraen. Empezamos por medir y entender tu caso.',
   60, NULL, false, true, 'solo_admin', 13),
  ('protesis-dentales', 'Prótesis dentales',
   'Reemplazos fijos o removibles para dientes ausentes, ajustados a tu boca.',
   60, NULL, false, true, 'solo_admin', 14)
ON CONFLICT (slug) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  descripcion = EXCLUDED.descripcion,
  duracion_min = EXCLUDED.duracion_min,
  precio_cop = EXCLUDED.precio_cop,
  mostrar_precio = EXCLUDED.mostrar_precio,
  visible_en_landing = EXCLUDED.visible_en_landing,
  politica_reserva = EXCLUDED.politica_reserva,
  orden = EXCLUDED.orden,
  activo = true;

-- Horario ficticio: lunes a viernes en dos tramos, sábado en la mañana.
DELETE FROM horario_laboral;
INSERT INTO horario_laboral (dia_semana, hora_inicio, hora_fin)
VALUES
  (1, '08:00', '12:00'), (1, '14:00', '18:00'),
  (2, '08:00', '12:00'), (2, '14:00', '18:00'),
  (3, '08:00', '12:00'), (3, '14:00', '18:00'),
  (4, '08:00', '12:00'), (4, '14:00', '18:00'),
  (5, '08:00', '12:00'), (5, '14:00', '18:00'),
  (6, '08:00', '12:00');
