-- 0013 · Versiones del texto de autorización de tratamiento de datos.
-- Cada consentimiento guarda la versión (y el texto) que aceptó el paciente: el texto no se sobrescribe,
-- cada cambio desde el panel es una versión nueva. La vigente es la última creada.
-- Una versión "borrador-…" es texto real sin aprobar: no habilita la reserva en producción.

CREATE TABLE texto_autorizacion (
  orden         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  version       text NOT NULL UNIQUE CHECK (version ~ '^[a-z0-9][a-z0-9.-]{0,59}$'),
  texto         text NOT NULL CHECK (length(trim(texto)) BETWEEN 20 AND 20000),
  demostracion  boolean NOT NULL DEFAULT false,
  creado_en     timestamptz NOT NULL DEFAULT now(),
  -- Usuario del panel que la guardó; null si la cargó un script.
  creado_por    text REFERENCES "user" (id) ON DELETE RESTRICT
);

CREATE TRIGGER texto_autorizacion_solo_insercion BEFORE UPDATE OR DELETE ON texto_autorizacion
  FOR EACH ROW EXECUTE FUNCTION solo_insercion();

-- El texto que hubiera en configuracion pasa a ser la primera versión.
INSERT INTO texto_autorizacion (version, texto, demostracion)
SELECT lower(valor ->> 'version'), valor ->> 'texto', coalesce((valor ->> 'demostracion')::boolean, false)
FROM configuracion
WHERE clave = 'texto_autorizacion_datos'
  AND jsonb_typeof(valor) = 'object'
  AND lower(valor ->> 'version') ~ '^[a-z0-9][a-z0-9.-]{0,59}$'
  AND length(trim(valor ->> 'texto')) BETWEEN 20 AND 20000;

DELETE FROM configuracion WHERE clave = 'texto_autorizacion_datos';
