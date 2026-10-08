# Encargo: fase 0 (base técnica) y fase 1 (landing)

Lee `CLAUDE.md`, `docs/brief.md` y `docs/propuesta-tecnica.md` completos antes de hacer nada.

Alcance: fases 0 y 1 de la propuesta, §17. No adelantes nada de las fases 2 en adelante.

## Fase 0

- Proyecto Next.js (App Router) con TypeScript estricto y Tailwind, con la estructura de `CLAUDE.md`. Gestor de paquetes: npm.
- PostgreSQL con migraciones SQL en `db/migrations`. Primera migración: `usuario`, `servicio`, `configuracion` y `auditoria`. Nada de pacientes ni citas todavía.
- Autenticación del panel con segundo factor y una ruta `/admin` protegida, vacía.
- Linter, pruebas y un flujo de CI que corra ambos.
- `.env.example`; ningún secreto en el repositorio. Respeta el `.gitignore` existente.

## Fase 1

- Landing: hero, antes y después, servicios (leídos de la base de datos), contacto y botón flotante de WhatsApp.
- Usa exclusivamente los logos de `public/brand`; no generes ni sustituyas ningún logo ni ícono de marca.
  - Cabecera: `isotipo.svg` junto a `wordmark.svg`.
  - Favicon: `diente.svg`.
  - Pie de página: `logo-completo.svg`.
  - Van incrustados como SVG en línea para que tomen el color del texto (usan `currentColor`).
- Diseño: sigue la sección "Dirección visual" de `CLAUDE.md`. Paleta: grises, azul de acento, blanco.
- Contenido: sigue la regla de contenido de demostración de `CLAUDE.md`. Crea `db/seed/demo.sql` con servicios, duraciones, horarios y precios ficticios, la cinta de demostración y el bloqueo de despliegue.
- Los botones de "Agendar" apuntan a `/reservar`, que por ahora es una página "próximamente" con el enlace a WhatsApp.

## Antes de escribir código

Preséntame y espera mi aprobación:

1. Qué vas a hacer y en qué orden.
2. Qué librerías eliges para autenticación y acceso a datos, y por qué.
3. Dos direcciones visuales para la landing (tipografías, paleta exacta, composición del hero).

## Al terminar

Dime los comandos exactos para instalar, crear la base de datos local, correr migraciones y semilla, y levantar el sitio en Windows.
