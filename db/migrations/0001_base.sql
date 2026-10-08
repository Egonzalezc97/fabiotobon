-- 0001 · Base: autenticación del panel, usuarios, servicios, configuración y auditoría.

-- ---------------------------------------------------------------------------
-- Better Auth (nombres por defecto de la librería, versión 1.7 con el plugin twoFactor).
-- Generado con getMigrations() de better-auth y copiado aquí para versionarlo.
-- Si se actualiza la librería, se compara su esquema con este y se agrega una migración nueva.
-- ---------------------------------------------------------------------------

CREATE TABLE "user" (
  "id" text NOT NULL PRIMARY KEY,
  "name" text NOT NULL,
  "email" text NOT NULL UNIQUE,
  "emailVerified" boolean NOT NULL,
  "image" text,
  "createdAt" timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "twoFactorEnabled" boolean
);

CREATE TABLE "session" (
  "id" text NOT NULL PRIMARY KEY,
  "expiresAt" timestamptz NOT NULL,
  "token" text NOT NULL UNIQUE,
  "createdAt" timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" timestamptz NOT NULL,
  "ipAddress" text,
  "userAgent" text,
  "userId" text NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE
);

CREATE TABLE "account" (
  "id" text NOT NULL PRIMARY KEY,
  "accountId" text NOT NULL,
  "providerId" text NOT NULL,
  "userId" text NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  "scope" text,
  "password" text,
  "createdAt" timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" timestamptz NOT NULL
);

CREATE TABLE "verification" (
  "id" text NOT NULL PRIMARY KEY,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expiresAt" timestamptz NOT NULL,
  "createdAt" timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "twoFactor" (
  "id" text NOT NULL PRIMARY KEY,
  "secret" text NOT NULL,
  "backupCodes" text NOT NULL,
  "userId" text NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  "verified" boolean,
  "failedVerificationCount" integer,
  "lockedUntil" timestamptz
);

CREATE INDEX "session_userId_idx" ON "session" ("userId");
CREATE INDEX "account_userId_idx" ON "account" ("userId");
CREATE INDEX "verification_identifier_idx" ON "verification" ("identifier");
CREATE INDEX "twoFactor_secret_idx" ON "twoFactor" ("secret");
CREATE INDEX "twoFactor_userId_idx" ON "twoFactor" ("userId");

-- ---------------------------------------------------------------------------
-- Dominio
-- ---------------------------------------------------------------------------

-- Personal con acceso al panel. Una cuenta de Better Auth sin fila aquí no entra al panel.
-- Solo existe el rol admin; "asistente" se agrega si algún día se contrata a alguien (propuesta §14).
CREATE TABLE usuario (
  user_id     text PRIMARY KEY REFERENCES "user" ("id") ON DELETE RESTRICT,
  rol         text NOT NULL CHECK (rol IN ('admin')),
  activo      boolean NOT NULL DEFAULT true,
  creado_en   timestamptz NOT NULL DEFAULT now()
);

-- Tipos de cita / procedimientos. Se desactivan, nunca se borran.
CREATE TABLE servicio (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  nombre              text NOT NULL CHECK (length(trim(nombre)) > 0),
  descripcion         text NOT NULL DEFAULT '',
  duracion_min        integer NOT NULL CHECK (duracion_min > 0 AND duracion_min <= 600),
  -- Pesos colombianos, sin decimales. NULL = sin precio definido.
  precio_cop          integer CHECK (precio_cop IS NULL OR precio_cop >= 0),
  mostrar_precio      boolean NOT NULL DEFAULT false,
  visible_en_landing  boolean NOT NULL DEFAULT true,
  -- publico: lo agenda cualquiera (valoración) · pacientes: solo pacientes habilitados · solo_admin: solo desde el panel
  politica_reserva    text NOT NULL DEFAULT 'solo_admin' CHECK (politica_reserva IN ('publico', 'pacientes', 'solo_admin')),
  orden               integer NOT NULL DEFAULT 0,
  activo              boolean NOT NULL DEFAULT true,
  creado_en           timestamptz NOT NULL DEFAULT now(),
  actualizado_en      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT servicio_precio_visible_requiere_precio CHECK (NOT mostrar_precio OR precio_cop IS NOT NULL)
);

CREATE INDEX servicio_landing_idx ON servicio (orden) WHERE activo AND visible_en_landing;

-- Reglas de negocio editables (antelación, horizonte, granularidad, políticas, datos de contacto…).
-- Clave/valor para no migrar el esquema cada vez que aparece una regla; el módulo valida cada clave.
CREATE TABLE configuracion (
  clave           text PRIMARY KEY CHECK (clave ~ '^[a-z0-9_]+$'),
  valor           jsonb NOT NULL,
  descripcion     text NOT NULL DEFAULT '',
  actualizado_en  timestamptz NOT NULL DEFAULT now()
);

-- Registro de acciones y de lecturas de datos sensibles. Solo se inserta.
CREATE TABLE auditoria (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ocurrido_en timestamptz NOT NULL DEFAULT now(),
  -- Sin llave foránea a propósito: el registro debe sobrevivir aunque se elimine el usuario.
  actor_id    text,
  actor_tipo  text NOT NULL CHECK (actor_tipo IN ('usuario', 'sistema', 'anonimo')),
  accion      text NOT NULL CHECK (accion ~ '^[a-z0-9_.]+$'),
  entidad     text,
  entidad_id  text,
  detalle     jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip          text,
  user_agent  text
);

CREATE INDEX auditoria_ocurrido_en_idx ON auditoria (ocurrido_en DESC);
CREATE INDEX auditoria_actor_idx ON auditoria (actor_id, ocurrido_en DESC);
CREATE INDEX auditoria_entidad_idx ON auditoria (entidad, entidad_id);

CREATE FUNCTION auditoria_solo_insercion() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'auditoria es de solo inserción';
END;
$$;

CREATE TRIGGER auditoria_sin_cambios
  BEFORE UPDATE OR DELETE ON auditoria
  FOR EACH ROW EXECUTE FUNCTION auditoria_solo_insercion();

CREATE TRIGGER auditoria_sin_truncate
  BEFORE TRUNCATE ON auditoria
  FOR EACH STATEMENT EXECUTE FUNCTION auditoria_solo_insercion();

-- Mantiene actualizado_en al día en las tablas de dominio que lo tienen.
CREATE FUNCTION marcar_actualizado() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.actualizado_en := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER servicio_actualizado BEFORE UPDATE ON servicio
  FOR EACH ROW EXECUTE FUNCTION marcar_actualizado();

CREATE TRIGGER configuracion_actualizado BEFORE UPDATE ON configuracion
  FOR EACH ROW EXECUTE FUNCTION marcar_actualizado();
