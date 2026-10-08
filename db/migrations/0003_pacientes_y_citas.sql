-- 0003 · Pacientes, citas, historial de citas, bloqueos y consentimientos.
-- Todas las fechas en UTC (timestamptz); la zona de negocio es America/Bogota.

-- unaccent: búsqueda de pacientes sin importar tildes. Extensión "trusted" desde PostgreSQL 13.
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Función genérica para tablas de solo inserción (historiales y evidencias).
CREATE FUNCTION solo_insercion() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% es de solo inserción', TG_TABLE_NAME;
END;
$$;

-- ---------------------------------------------------------------------------
-- Paciente: identificado por documento (tipo + número). El celular es el contacto
-- verificado y puede compartirse (p. ej. una madre agenda a sus hijos con su número).
-- DPF: estados del paciente; por ahora solo activo/inactivo.
-- El documento admite nulos solo si Fabio decide no exigirlo en la reserva web (DPF);
-- el panel siempre lo exige. Menores: su propio documento (TI, RC) los identifica.
-- ---------------------------------------------------------------------------
CREATE TABLE paciente (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_documento         text CHECK (tipo_documento IN ('CC', 'TI', 'RC', 'CE', 'PA')),
  numero_documento       text,
  nombre                 text NOT NULL CHECK (length(trim(nombre)) BETWEEN 1 AND 200),
  celular                text CHECK (celular ~ '^\+[1-9][0-9]{7,14}$'),
  celular_verificado_en  timestamptz,
  correo                 text CHECK (correo IS NULL OR correo ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  estado                 text NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo')),
  notas                  text NOT NULL DEFAULT '',
  creado_en              timestamptz NOT NULL DEFAULT now(),
  actualizado_en         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT paciente_documento_completo CHECK ((tipo_documento IS NULL) = (numero_documento IS NULL)),
  -- Validación básica de formato (sin servicios externos). Números normalizados: sin puntos ni espacios, en mayúsculas.
  CONSTRAINT paciente_documento_formato CHECK (
    numero_documento IS NULL OR CASE tipo_documento
      WHEN 'CC' THEN numero_documento ~ '^[0-9]{3,10}$'
      WHEN 'TI' THEN numero_documento ~ '^[0-9]{10,11}$'
      WHEN 'RC' THEN numero_documento ~ '^[0-9A-Z]{6,15}$'
      WHEN 'CE' THEN numero_documento ~ '^[0-9A-Z]{3,12}$'
      WHEN 'PA' THEN numero_documento ~ '^[0-9A-Z]{5,15}$'
    END
  ),
  CONSTRAINT paciente_documento_unico UNIQUE (tipo_documento, numero_documento),
  CONSTRAINT paciente_verificado_requiere_celular CHECK (celular_verificado_en IS NULL OR celular IS NOT NULL)
);

CREATE INDEX paciente_celular_idx ON paciente (celular);
CREATE INDEX paciente_nombre_idx ON paciente (lower(nombre));

CREATE TRIGGER paciente_actualizado BEFORE UPDATE ON paciente
  FOR EACH ROW EXECUTE FUNCTION marcar_actualizado();

-- ---------------------------------------------------------------------------
-- Cita: la única entidad de cita. Nunca se borra; cambia de estado.
-- ---------------------------------------------------------------------------
CREATE TABLE cita (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id     uuid NOT NULL REFERENCES paciente (id) ON DELETE RESTRICT,
  servicio_id     uuid NOT NULL REFERENCES servicio (id) ON DELETE RESTRICT,
  inicio          timestamptz NOT NULL,
  fin             timestamptz NOT NULL,
  estado          text NOT NULL CHECK (estado IN ('pendiente', 'confirmada', 'cancelada', 'cumplida', 'no_asistio')),
  origen          text NOT NULL CHECK (origen IN ('web', 'panel', 'whatsapp')),
  notas_internas  text NOT NULL DEFAULT '',
  -- Marca para que Fabio revise la identidad (p. ej. documento existente reservado desde otro celular).
  revision        text CHECK (revision IN ('documento_con_otro_celular', 'sin_documento')),
  -- Cuándo la abrió Fabio en el panel. Cubre la falta de avisos hasta la fase 3.
  vista_en        timestamptz,
  creada_en       timestamptz NOT NULL DEFAULT now(),
  actualizada_en  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cita_rango_valido CHECK (fin > inicio),
  -- Garantía de no-solapamiento: la da PostgreSQL, no el código. Solo cuentan las citas activas.
  CONSTRAINT cita_sin_solapes EXCLUDE USING gist (tstzrange(inicio, fin, '[)') WITH &&)
    WHERE (estado IN ('pendiente', 'confirmada'))
);

CREATE INDEX cita_inicio_idx ON cita (inicio);
CREATE INDEX cita_paciente_idx ON cita (paciente_id, inicio);
CREATE INDEX cita_sin_ver_idx ON cita (creada_en) WHERE vista_en IS NULL;

CREATE FUNCTION marcar_actualizada() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.actualizada_en := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER cita_actualizada BEFORE UPDATE ON cita
  FOR EACH ROW EXECUTE FUNCTION marcar_actualizada();

-- Historial de cada cita: creada, reprogramada (antes/después), cancelada, cambio de estado, vista.
CREATE TABLE cita_evento (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cita_id      uuid NOT NULL REFERENCES cita (id) ON DELETE RESTRICT,
  tipo         text NOT NULL CHECK (tipo IN ('creada', 'reprogramada', 'cancelada', 'estado_cambiado', 'vista')),
  antes        jsonb,
  despues      jsonb,
  actor_tipo   text NOT NULL CHECK (actor_tipo IN ('usuario', 'paciente', 'sistema')),
  actor_id     text,
  detalle      jsonb NOT NULL DEFAULT '{}'::jsonb,
  ocurrido_en  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX cita_evento_cita_idx ON cita_evento (cita_id, id);

CREATE TRIGGER cita_evento_solo_insercion BEFORE UPDATE OR DELETE ON cita_evento
  FOR EACH ROW EXECUTE FUNCTION solo_insercion();

-- ---------------------------------------------------------------------------
-- Bloqueo de agenda. El motivo es privado: nunca sale del panel.
-- ---------------------------------------------------------------------------
CREATE TABLE bloqueo (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inicio       timestamptz NOT NULL,
  fin          timestamptz NOT NULL,
  dia_completo boolean NOT NULL DEFAULT false,
  motivo       text NOT NULL DEFAULT '' CHECK (length(motivo) <= 300),
  creado_por   text,
  creado_en    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bloqueo_rango_valido CHECK (fin > inicio)
);

CREATE INDEX bloqueo_rango_idx ON bloqueo USING gist (tstzrange(inicio, fin, '[)'));

-- ---------------------------------------------------------------------------
-- Consentimiento: copia completa del texto aceptado, para saber qué aceptó cada paciente
-- aunque el texto cambie después.
-- ---------------------------------------------------------------------------
CREATE TABLE consentimiento (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id    uuid NOT NULL REFERENCES paciente (id) ON DELETE RESTRICT,
  cita_id        uuid REFERENCES cita (id) ON DELETE RESTRICT,
  tipo           text NOT NULL CHECK (tipo IN ('tratamiento_datos')),
  version        text NOT NULL,
  texto          text NOT NULL,
  texto_sha256   text NOT NULL CHECK (texto_sha256 ~ '^[0-9a-f]{64}$'),
  origen         text NOT NULL CHECK (origen IN ('web', 'panel')),
  aceptado_en    timestamptz NOT NULL DEFAULT now(),
  ip             text,
  user_agent     text
);

CREATE INDEX consentimiento_paciente_idx ON consentimiento (paciente_id, aceptado_en DESC);

CREATE TRIGGER consentimiento_solo_insercion BEFORE UPDATE OR DELETE ON consentimiento
  FOR EACH ROW EXECUTE FUNCTION solo_insercion();
