-- 0004 · Reserva pública: solicitudes, verificación del celular por código y parámetros de agenda.

-- Datos de una reserva en curso, entre pantallas. El navegador solo guarda un token aleatorio
-- (cookie httpOnly); aquí se guarda su hash. Se purgan a las 24 horas.
CREATE TABLE solicitud_reserva (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_sha256            text NOT NULL UNIQUE CHECK (token_sha256 ~ '^[0-9a-f]{64}$'),
  servicio_id             uuid NOT NULL REFERENCES servicio (id) ON DELETE CASCADE,
  inicio                  timestamptz NOT NULL,
  tipo_documento          text CHECK (tipo_documento IN ('CC', 'TI', 'RC', 'CE', 'PA')),
  numero_documento        text,
  nombre                  text NOT NULL,
  celular                 text NOT NULL CHECK (celular ~ '^\+[1-9][0-9]{7,14}$'),
  correo                  text,
  consentimiento_version  text NOT NULL,
  consentimiento_sha256   text NOT NULL,
  estado                  text NOT NULL DEFAULT 'pendiente_codigo'
                          CHECK (estado IN ('pendiente_codigo', 'verificada', 'completada')),
  verificada_en           timestamptz,
  cita_id                 uuid REFERENCES cita (id) ON DELETE SET NULL,
  ip                      text,
  user_agent              text,
  creada_en               timestamptz NOT NULL DEFAULT now(),
  expira_en               timestamptz NOT NULL
);

CREATE INDEX solicitud_reserva_creada_idx ON solicitud_reserva (creada_en);

-- Códigos de verificación. Nunca en claro: HMAC-SHA256 con el secreto del servidor.
-- Las filas sirven también para contar los límites por IP y por celular (sobreviven a reinicios).
CREATE TABLE verificacion_celular (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitud_id  uuid REFERENCES solicitud_reserva (id) ON DELETE SET NULL,
  celular       text NOT NULL,
  codigo_hmac   text NOT NULL,
  intentos      integer NOT NULL DEFAULT 0 CHECK (intentos >= 0),
  expira_en     timestamptz NOT NULL,
  consumida_en  timestamptz,
  ip            text,
  creada_en     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX verificacion_celular_celular_idx ON verificacion_celular (celular, creada_en DESC);
CREATE INDEX verificacion_celular_ip_idx ON verificacion_celular (ip, creada_en DESC);
CREATE INDEX verificacion_celular_solicitud_idx ON verificacion_celular (solicitud_id, creada_en DESC);

-- Intentos de verificación (correctos o no), para el límite por IP.
CREATE TABLE intento_verificacion (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ip         text,
  exitoso    boolean NOT NULL,
  creado_en  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX intento_verificacion_ip_idx ON intento_verificacion (ip, creado_en DESC);

-- ---------------------------------------------------------------------------
-- Parámetros de agenda y reserva. DECISIONES PENDIENTES DE FABIO (DPF): valores por defecto
-- acordados en el encargo de la fase 2, editables desde el panel. No pisa valores existentes.
-- ---------------------------------------------------------------------------
INSERT INTO configuracion (clave, valor, descripcion) VALUES
  ('agenda_granularidad_min', '15', 'DPF · Cada cuántos minutos se ofrece un cupo'),
  ('agenda_antelacion_min', '120', 'DPF · Minutos mínimos entre ahora y el inicio de una reserva web'),
  ('agenda_horizonte_dias', '30', 'DPF · Cuántos días hacia adelante se puede reservar en la web'),
  ('cita_web_estado_inicial', '"confirmada"', 'DPF · Estado con el que nace una cita web: confirmada o pendiente'),
  ('reserva_documento_obligatorio', 'true', 'DPF · Pedir tipo y número de documento en la reserva web'),
  ('reserva_max_valoraciones_futuras', '1', 'DPF · Valoraciones futuras activas permitidas por documento')
ON CONFLICT (clave) DO NOTHING;
