-- 0010 · Galería de antes y después administrable.
-- Originales: almacenamiento PRIVADO, sin metadatos (recodificados a máxima calidad).
-- Versiones públicas (AVIF/WebP en varios anchos): existen solo mientras el caso está publicado.

CREATE TABLE imagen (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clave_original  text NOT NULL UNIQUE,
  formato         text NOT NULL CHECK (formato IN ('jpeg', 'png')),
  ancho           integer NOT NULL CHECK (ancho > 0),
  alto            integer NOT NULL CHECK (alto > 0),
  bytes           integer NOT NULL CHECK (bytes > 0),
  sha256          text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  subido_por      text,
  creado_en       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE imagen_variante (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imagen_id  uuid NOT NULL REFERENCES imagen (id) ON DELETE CASCADE,
  clave      text NOT NULL UNIQUE,
  formato    text NOT NULL CHECK (formato IN ('avif', 'webp')),
  ancho      integer NOT NULL CHECK (ancho > 0),
  alto       integer NOT NULL CHECK (alto > 0),
  bytes      integer NOT NULL CHECK (bytes > 0),
  creado_en  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX imagen_variante_imagen_idx ON imagen_variante (imagen_id);

-- Consentimiento de uso de imagen: paciente, fecha de firma y el documento firmado (archivo privado) o la
-- marca explícita "autorización escrita en físico" con quién la verificó.
CREATE TABLE consentimiento_imagen (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id     uuid NOT NULL REFERENCES paciente (id) ON DELETE RESTRICT,
  fecha_firma     date NOT NULL,
  archivo_clave   text UNIQUE,
  archivo_tipo    text CHECK (archivo_tipo IS NULL OR archivo_tipo IN ('application/pdf', 'image/jpeg', 'image/png')),
  en_fisico       boolean NOT NULL DEFAULT false,
  verificado_por  text CHECK (verificado_por IS NULL OR length(trim(verificado_por)) BETWEEN 3 AND 120),
  notas           text NOT NULL DEFAULT '' CHECK (length(notas) <= 500),
  registrado_por  text,
  creado_en       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT consentimiento_imagen_evidencia CHECK (
    (archivo_clave IS NOT NULL AND archivo_tipo IS NOT NULL)
    OR (en_fisico AND verificado_por IS NOT NULL)
  )
);

-- Evidencia: solo inserción, salvo moverse de ficha dentro de una fusión (misma marca que consentimiento).
CREATE FUNCTION consentimiento_imagen_proteger() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND current_setting('app.fusion_pacientes', true) = 'on'
     AND (to_jsonb(NEW) - 'paciente_id') = (to_jsonb(OLD) - 'paciente_id') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'consentimiento_imagen es de solo inserción';
END;
$$;

CREATE TRIGGER consentimiento_imagen_proteger BEFORE UPDATE OR DELETE ON consentimiento_imagen
  FOR EACH ROW EXECUTE FUNCTION consentimiento_imagen_proteger();

CREATE TABLE caso_galeria (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  procedimiento             text NOT NULL CHECK (length(trim(procedimiento)) BETWEEN 2 AND 80),
  servicio_id               uuid REFERENCES servicio (id) ON DELETE RESTRICT,
  descripcion               text NOT NULL DEFAULT '' CHECK (length(descripcion) <= 200),
  imagen_antes_id           uuid NOT NULL REFERENCES imagen (id) ON DELETE RESTRICT,
  imagen_despues_id         uuid NOT NULL REFERENCES imagen (id) ON DELETE RESTRICT,
  consentimiento_imagen_id  uuid REFERENCES consentimiento_imagen (id) ON DELETE RESTRICT,
  estado                    text NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador', 'publicado')),
  orden                     integer NOT NULL DEFAULT 0,
  creado_por                text,
  creado_en                 timestamptz NOT NULL DEFAULT now(),
  actualizado_en            timestamptz NOT NULL DEFAULT now(),
  publicado_en              timestamptz,
  publicado_por             text,
  CONSTRAINT caso_imagenes_distintas CHECK (imagen_antes_id <> imagen_despues_id),
  -- No se publica un caso sin consentimiento de uso de imagen vinculado.
  CONSTRAINT caso_publicado_con_consentimiento CHECK (estado <> 'publicado' OR consentimiento_imagen_id IS NOT NULL)
);

CREATE INDEX caso_galeria_publicados_idx ON caso_galeria (orden, publicado_en) WHERE estado = 'publicado';

CREATE TRIGGER caso_galeria_actualizado BEFORE UPDATE ON caso_galeria
  FOR EACH ROW EXECUTE FUNCTION marcar_actualizado();
