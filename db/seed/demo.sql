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

-- ---------------------------------------------------------------------------
-- Fase 2 · Reserva y agenda de DEMOSTRACIÓN
-- ---------------------------------------------------------------------------

-- Texto de autorización FICTICIO. Marcado como demostración: en producción no habilita la reserva.
-- El texto real lo redacta Fabio con su abogado (Ley 1581 de 2012).
INSERT INTO configuracion (clave, valor, descripcion)
VALUES (
  'texto_autorizacion_datos',
  jsonb_build_object(
    'version', 'demo-1',
    'demostracion', true,
    'texto', 'TEXTO DE DEMOSTRACIÓN. No es una autorización real.' || E'\n\n' ||
      'Al reservar autorizas que tus datos de contacto e identificación se usen para agendar y gestionar tu cita. ' ||
      'Aquí irá la autorización redactada por Fabio y su abogado: responsable, finalidades, derechos del titular ' ||
      'y canales para ejercerlos.'
  ),
  'Texto vigente de la autorización de tratamiento de datos'
)
ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor;

-- Pacientes ficticios. Documentos tipo PA con prefijo DEMO para que no coincidan con documentos reales,
-- y sin celular para no apuntar a números de terceros.
INSERT INTO paciente (tipo_documento, numero_documento, nombre, notas)
VALUES
  ('PA', 'DEMO0001', 'Laura Méndez', 'Paciente de demostración'),
  ('PA', 'DEMO0002', 'Andrés Rincón', 'Paciente de demostración'),
  ('PA', 'DEMO0003', 'Camila Ortiz', 'Paciente de demostración'),
  ('PA', 'DEMO0004', 'Julián Castaño', 'Paciente de demostración'),
  ('PA', 'DEMO0005', 'Valentina Ruiz', 'Paciente de demostración')
ON CONFLICT (tipo_documento, numero_documento) DO NOTHING;

-- Citas y bloqueos con fechas relativas a hoy (días hábiles siguientes). Solo se crean una vez.
CREATE TEMP TABLE _dias_demo ON COMMIT DROP AS
SELECT row_number() OVER (ORDER BY d) AS n, d::date AS fecha
FROM generate_series(
  (now() AT TIME ZONE 'America/Bogota')::date + 1,
  (now() AT TIME ZONE 'America/Bogota')::date + 21,
  interval '1 day'
) AS d
WHERE extract(isodow FROM d) BETWEEN 1 AND 5;

INSERT INTO _dias_demo (n, fecha)
SELECT 0, max(d)::date
FROM generate_series(
  (now() AT TIME ZONE 'America/Bogota')::date - 7,
  (now() AT TIME ZONE 'America/Bogota')::date - 1,
  interval '1 day'
) AS d
WHERE extract(isodow FROM d) BETWEEN 1 AND 5;

CREATE TEMP TABLE _citas_demo ON COMMIT DROP AS
SELECT * FROM (VALUES
  -- (día hábil n, hora local, documento, servicio, estado, origen, revisión, ¿vista?)
  (1, time '08:00', 'DEMO0001', 'valoracion-odontologica', 'confirmada', 'panel', NULL, true),
  (1, time '09:00', 'DEMO0002', 'limpieza-dental', 'confirmada', 'panel', NULL, true),
  (1, time '14:00', 'DEMO0003', 'diseno-de-sonrisa', 'confirmada', 'panel', NULL, true),
  (2, time '08:30', 'DEMO0004', 'valoracion-odontologica', 'confirmada', 'web', NULL, false),
  (2, time '10:00', 'DEMO0001', 'restauraciones', 'pendiente', 'panel', NULL, true),
  (3, time '09:00', 'DEMO0002', 'valoracion-odontologica', 'confirmada', 'web', 'documento_con_otro_celular', false),
  (3, time '15:00', 'DEMO0005', 'endodoncia', 'confirmada', 'panel', NULL, true),
  (4, time '08:00', 'DEMO0003', 'ortodoncia', 'confirmada', 'panel', NULL, true),
  (0, time '10:00', 'DEMO0005', 'limpieza-dental', 'cumplida', 'panel', NULL, true),
  (0, time '11:00', 'DEMO0004', 'valoracion-odontologica', 'no_asistio', 'web', NULL, true)
) AS c (n, hora, documento, servicio, estado, origen, revision, vista);

INSERT INTO cita (paciente_id, servicio_id, inicio, fin, estado, origen, revision, vista_en, notas_internas)
SELECT
  p.id,
  s.id,
  (d.fecha + c.hora) AT TIME ZONE 'America/Bogota',
  (d.fecha + c.hora) AT TIME ZONE 'America/Bogota' + make_interval(mins => s.duracion_min),
  c.estado,
  c.origen,
  c.revision,
  CASE WHEN c.vista THEN now() END,
  'Cita de demostración'
FROM _citas_demo c
JOIN _dias_demo d ON d.n = c.n
JOIN paciente p ON p.tipo_documento = 'PA' AND p.numero_documento = c.documento
JOIN servicio s ON s.slug = c.servicio
WHERE NOT EXISTS (
  SELECT 1 FROM cita ci JOIN paciente pa ON pa.id = ci.paciente_id WHERE pa.numero_documento LIKE 'DEMO%'
);

INSERT INTO cita_evento (cita_id, tipo, despues, actor_tipo, detalle)
SELECT ci.id, 'creada',
  jsonb_build_object('inicio', ci.inicio, 'fin', ci.fin, 'estado', ci.estado, 'origen', ci.origen),
  'sistema', '{"demostracion": true}'::jsonb
FROM cita ci
JOIN paciente pa ON pa.id = ci.paciente_id
WHERE pa.numero_documento LIKE 'DEMO%'
  AND NOT EXISTS (SELECT 1 FROM cita_evento ev WHERE ev.cita_id = ci.id);

INSERT INTO bloqueo (inicio, fin, dia_completo, motivo)
SELECT * FROM (
  SELECT (fecha + time '15:00') AT TIME ZONE 'America/Bogota',
         (fecha + time '16:30') AT TIME ZONE 'America/Bogota',
         false, 'Reunión con el laboratorio (demostración)'
  FROM _dias_demo WHERE n = 2
  UNION ALL
  SELECT fecha::timestamp AT TIME ZONE 'America/Bogota',
         (fecha + 1)::timestamp AT TIME ZONE 'America/Bogota',
         true, 'Congreso (demostración)'
  FROM _dias_demo WHERE n = 6
) AS b
WHERE NOT EXISTS (SELECT 1 FROM bloqueo WHERE motivo LIKE '%(demostración)');
