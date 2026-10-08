-- 0007 · Usuarios del panel: ingreso con nombre de usuario, rol asistente y cambio de contraseña obligatorio.

-- Plugin `username` de Better Auth (sin displayUsername). Generado con getMigrations() de better-auth.
ALTER TABLE "user" ADD COLUMN "username" text;
CREATE UNIQUE INDEX "user_username_uidx" ON "user" ("username");

-- Formato del nombre de usuario: el plugin lo guarda en minúsculas (único sin distinguir mayúsculas);
-- solo letras, números y punto, entre 3 y 30 caracteres.
ALTER TABLE "user" ADD CONSTRAINT user_username_formato CHECK (username IS NULL OR username ~ '^[a-z0-9.]{3,30}$');

-- Roles: admin (todo) y asistente (agenda, pacientes, tratamientos y abonos).
ALTER TABLE usuario DROP CONSTRAINT usuario_rol_check;
ALTER TABLE usuario ADD CONSTRAINT usuario_rol_check CHECK (rol IN ('admin', 'asistente'));

-- Alta con contraseña temporal: en el primer ingreso debe cambiarla (y luego activar el segundo factor).
ALTER TABLE usuario ADD COLUMN debe_cambiar_contrasena boolean NOT NULL DEFAULT false;
ALTER TABLE usuario ADD COLUMN creado_por text;

-- Nombre de usuario para las cuentas existentes: inicial del primer nombre + primer apellido + inicial del
-- segundo apellido, sin tildes y en minúsculas; con número si ya existe. Misma regla que sugerirNombreUsuario().
DO $$
DECLARE
  fila record;
  partes text[];
  n int;
  base text;
  candidato text;
  sufijo int;
BEGIN
  FOR fila IN SELECT id, name FROM "user" WHERE username IS NULL ORDER BY "createdAt" LOOP
    partes := ARRAY(
      SELECT regexp_replace(p, '[^a-z0-9]', '', 'g')
      FROM unnest(regexp_split_to_array(lower(unaccent(trim(fila.name))), '\s+')) AS p
      WHERE regexp_replace(p, '[^a-z0-9]', '', 'g') <> ''
    );
    n := coalesce(array_length(partes, 1), 0);
    base := CASE
      WHEN n >= 3 THEN left(partes[1], 1) || partes[n - 1] || left(partes[n], 1)
      WHEN n = 2 THEN left(partes[1], 1) || partes[2]
      WHEN n = 1 THEN partes[1]
      ELSE 'usuario'
    END;
    base := left(base, 27);
    IF length(base) < 3 THEN base := rpad(base, 3, '0'); END IF;
    candidato := base;
    sufijo := 2;
    WHILE EXISTS (SELECT 1 FROM "user" WHERE username = candidato) LOOP
      candidato := base || sufijo;
      sufijo := sufijo + 1;
    END LOOP;
    UPDATE "user" SET username = candidato WHERE id = fila.id;
  END LOOP;
END;
$$;
