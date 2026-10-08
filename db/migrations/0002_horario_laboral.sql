-- 0002 · Horario laboral semanal.
-- Lo muestra la landing (contacto) y en la fase 2 es la base para calcular cupos.
-- Horas locales de America/Bogota (sin zona: es un patrón semanal, no un instante).

-- btree_gist permite combinar igualdad y rangos en una restricción de exclusión.
-- Es extensión "trusted" desde PostgreSQL 13: no requiere superusuario. La agenda (fase 2) también la usa.
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TYPE rango_hora AS RANGE (subtype = time);

CREATE TABLE horario_laboral (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- ISO 8601: 1 = lunes … 7 = domingo
  dia_semana   smallint NOT NULL CHECK (dia_semana BETWEEN 1 AND 7),
  hora_inicio  time NOT NULL,
  hora_fin     time NOT NULL,
  creado_en    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT horario_laboral_rango_valido CHECK (hora_fin > hora_inicio),
  -- Varios tramos por día (mañana y tarde), pero nunca superpuestos.
  CONSTRAINT horario_laboral_sin_solapes EXCLUDE USING gist (
    dia_semana WITH =,
    rango_hora(hora_inicio, hora_fin, '[)') WITH &&
  )
);
