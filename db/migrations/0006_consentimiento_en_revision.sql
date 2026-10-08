-- 0006 · Consentimiento de reservas en revisión de identidad.
-- Cuando un documento existente reserva desde OTRO celular, quien acepta la autorización puede no ser
-- el titular de la ficha (error de digitación, cambio de número o suplantación). Ese consentimiento NO se
-- asocia a la ficha: queda ligado a la cita, con los datos de quien lo aceptó, hasta que Fabio resuelva la
-- revisión vinculándolo (o, en la fase 3, hasta que el titular confirme desde su celular).

ALTER TABLE consentimiento
  ALTER COLUMN paciente_id DROP NOT NULL,
  ADD COLUMN aceptante_nombre    text,
  ADD COLUMN aceptante_documento text,
  ADD COLUMN aceptante_celular   text,
  ADD CONSTRAINT consentimiento_titular_o_cita CHECK (
    paciente_id IS NOT NULL
    OR (cita_id IS NOT NULL AND aceptante_nombre IS NOT NULL AND aceptante_celular IS NOT NULL)
  );

-- Sigue siendo de solo inserción, con UNA excepción: vincular a una ficha un consentimiento que no tenía
-- (paciente_id de NULL a un valor), sin cambiar ningún otro dato. Borrar sigue prohibido.
CREATE FUNCTION consentimiento_proteger() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.paciente_id IS NULL
     AND NEW.paciente_id IS NOT NULL
     AND (to_jsonb(NEW) - 'paciente_id') = (to_jsonb(OLD) - 'paciente_id') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'consentimiento es de solo inserción (solo se puede vincular a una ficha una vez)';
END;
$$;

DROP TRIGGER consentimiento_solo_insercion ON consentimiento;
CREATE TRIGGER consentimiento_proteger BEFORE UPDATE OR DELETE ON consentimiento
  FOR EACH ROW EXECUTE FUNCTION consentimiento_proteger();

-- Resolución de la revisión de identidad en la cita.
ALTER TABLE cita
  ADD COLUMN revision_resuelta_en  timestamptz,
  ADD COLUMN revision_resuelta_por text,
  ADD CONSTRAINT cita_resolucion_requiere_revision CHECK (revision_resuelta_en IS NULL OR revision IS NOT NULL);

ALTER TABLE cita_evento DROP CONSTRAINT cita_evento_tipo_check;
ALTER TABLE cita_evento ADD CONSTRAINT cita_evento_tipo_check
  CHECK (tipo IN ('creada', 'reprogramada', 'cancelada', 'estado_cambiado', 'vista', 'revision_resuelta'));
