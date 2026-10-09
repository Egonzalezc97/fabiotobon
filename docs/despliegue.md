# Despliegue

Destino previsto: Railway (aplicación + PostgreSQL). El paso de despliegue aún no se ha hecho; este documento reúne lo que ya está definido en el código. Se completa en esa fase.

## Variables de entorno

| Variable | Producción |
|---|---|
| `APP_ENV` | `production` (o `RAILWAY_ENVIRONMENT_NAME=production`, que también cuenta) |
| `DEMO_CONTENT` | `false` o sin definir. Con `true`, la compilación y el arranque fallan |
| `DATABASE_URL` | PostgreSQL de Railway |
| `BETTER_AUTH_SECRET` | Aleatorio, 32 caracteres o más |
| `BETTER_AUTH_URL` | URL pública del sitio |
| `VERIFICACION_SECRET` | Aleatorio, 32 caracteres o más, distinto de `BETTER_AUTH_SECRET` |
| `ALMACENAMIENTO_DIR` | Volumen persistente, mientras no exista la implementación S3 (pendiente) |

## Base de datos

- `npm run db:migrar` antes de arrancar la versión nueva.
- **Nunca** `npm run db:semilla-demo` ni `npm run politica:cargar-borrador`: los dos se niegan en producción.
- Primer usuario admin: `npm run usuario:crear` desde la consola de Railway.

## Checklist antes de abrir reservas en producción

- [ ] **Política y autorización aprobadas por Fabio y cargadas.**
  - Política: Panel → Configuración → Política de tratamiento de datos, sin marcadores (`[CORREO PARA SOLICITUDES]`, `[FECHA…`, `BORRADOR`). Hasta entonces `/tratamiento-de-datos` responde 404 y el sitio no la enlaza.
  - Autorización: Panel → Configuración → Autorización, guardada **sin** marcar «borrador». Mientras la vigente sea de demostración o `borrador-…`, la reserva web queda desactivada.
- [ ] Emisor real del código de verificación del celular (fase 3). Sin él, la reserva web está desactivada en producción.
- [ ] Dirección, WhatsApp y horario cargados: en producción, un dato que falta no se muestra.
