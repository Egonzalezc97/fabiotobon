-- 0008 · Ficha completa del paciente (sin campos clínicos), historial de cambios y fusión de fichas.

-- `celular` sigue siendo el WhatsApp (contacto verificado); `telefono` es un número adicional sin verificar.
ALTER TABLE paciente
  ADD COLUMN telefono         text CHECK (telefono IS NULL OR length(telefono) BETWEEN 7 AND 40),
  ADD COLUMN fecha_nacimiento date CHECK (fecha_nacimiento IS NULL OR fecha_nacimiento >= DATE '1900-01-01'),
  -- Ficha absorbida por otra en una fusión: queda inactiva y fuera de búsquedas; nunca se borra.
  ADD COLUMN fusionado_con    uuid REFERENCES paciente (id) ON DELETE RESTRICT,
  ADD COLUMN fusionado_en     timestamptz,
  ADD CONSTRAINT paciente_fusion_coherente CHECK ((fusionado_con IS NULL) = (fusionado_en IS NULL)),
  ADD CONSTRAINT paciente_no_fusionado_consigo CHECK (fusionado_con IS DISTINCT FROM id);

-- Historial de la ficha: qué campo cambió, valor anterior y nuevo, quién y cuándo. Solo inserción.
CREATE TABLE paciente_evento (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  paciente_id  uuid NOT NULL REFERENCES paciente (id) ON DELETE RESTRICT,
  tipo         text NOT NULL CHECK (tipo IN ('creado', 'actualizado', 'fusion_recibida', 'fusion_absorbida')),
  cambios      jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_tipo   text NOT NULL CHECK (actor_tipo IN ('usuario', 'paciente', 'sistema')),
  actor_id     text,
  ocurrido_en  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX paciente_evento_paciente_idx ON paciente_evento (paciente_id, id);

CREATE TRIGGER paciente_evento_solo_insercion BEFORE UPDATE OR DELETE ON paciente_evento
  FOR EACH ROW EXECUTE FUNCTION solo_insercion();

-- Las citas movidas por una fusión dejan evento propio.
ALTER TABLE cita_evento DROP CONSTRAINT cita_evento_tipo_check;
ALTER TABLE cita_evento ADD CONSTRAINT cita_evento_tipo_check
  CHECK (tipo IN ('creada', 'reprogramada', 'cancelada', 'estado_cambiado', 'vista', 'revision_resuelta', 'paciente_cambiado'));

-- Consentimiento: además de vincularse una vez (0006), puede MOVERSE de ficha solo dentro de una fusión.
-- La función de fusión activa la marca de transacción `app.fusion_pacientes`; nada más la usa.
CREATE OR REPLACE FUNCTION consentimiento_proteger() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.paciente_id IS NOT NULL
     AND (to_jsonb(NEW) - 'paciente_id') = (to_jsonb(OLD) - 'paciente_id')
     AND (OLD.paciente_id IS NULL OR current_setting('app.fusion_pacientes', true) = 'on') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'consentimiento es de solo inserción (solo se puede vincular a una ficha una vez)';
END;
$$;
