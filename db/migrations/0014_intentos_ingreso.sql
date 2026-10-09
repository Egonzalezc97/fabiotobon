-- 0014 · La contraseña es la única barrera obligatoria (2FA opcional, decisión del 2026-10-08).
-- Bloqueo por nombre de usuario y límite de intentos por IP guardado en la base (sobrevive a reinicios).

-- Fallos de ingreso por nombre de usuario ESCRITO (exista o no la cuenta: el bloqueo no revela qué usuarios existen).
-- 5 fallos dentro de 15 minutos bloquean 15 minutos. Un ingreso correcto borra la fila.
CREATE TABLE intento_ingreso (
  usuario          text PRIMARY KEY CHECK (usuario = lower(usuario) AND length(usuario) BETWEEN 1 AND 128),
  fallidos         integer NOT NULL DEFAULT 0 CHECK (fallidos >= 0),
  ultimo_fallo     timestamptz,
  bloqueado_hasta  timestamptz
);

-- Tabla del limitador de Better Auth (rateLimit.storage = "database"). Nombres y tipos los define Better Auth.
CREATE TABLE "rateLimit" (
  "id"           text PRIMARY KEY,
  "key"          text NOT NULL UNIQUE,
  "count"        integer NOT NULL,
  "lastRequest"  bigint NOT NULL
);
