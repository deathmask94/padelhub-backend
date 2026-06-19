# PadelHub — Backend

API REST para la plataforma de gestión de partidos de pádel PadelHub. Permite a los jugadores registrarse, buscar rivales, organizar partidos, registrar resultados con sistema ELO y recibir notificaciones. Incluye panel de administración completo.

## Tecnologías

- **Next.js 16** (App Router) — framework backend con rutas API
- **Prisma ORM** — acceso a base de datos con tipado
- **PostgreSQL** (Supabase) — base de datos en la nube
- **JWT HS256** — autenticación de jugadores (15 min) y administradores (4h)
- **bcryptjs** — hash de contraseñas
- **Resend** — emails transaccionales (bienvenida, recuperación, notificaciones)
- **Cloudinary** — almacenamiento de fotos de perfil
- **Jest + ts-jest** — pruebas unitarias (54 casos)

## Requisitos previos

- Node.js 18 o superior
- Cuenta en Supabase (PostgreSQL)
- Cuenta en Resend (emails)
- Cuenta en Cloudinary (imágenes)

## Variables de entorno

Crear archivo `.env` en la raíz del proyecto:

```env
# Base de datos
DATABASE_URL=postgresql://usuario:password@host:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://usuario:password@host:5432/postgres

# Autenticación
JWT_SECRET=tu_clave_secreta_aqui

# Email
RESEND_API_KEY=re_xxxxxxxxxxxx

# Cloudinary
CLOUDINARY_CLOUD_NAME=tu_cloud_name
CLOUDINARY_API_KEY=tu_api_key
CLOUDINARY_API_SECRET=tu_api_secret

# Frontend
FRONTEND_URL=http://localhost:5173
```

## Instalación y desarrollo

```bash
# Instalar dependencias
npm install

# Generar cliente Prisma
npx prisma generate

# Ejecutar migraciones (requiere DIRECT_URL)
npx prisma migrate deploy

# Iniciar servidor de desarrollo
npm run dev
```

El servidor queda disponible en `http://localhost:3000`

## Pruebas unitarias

```bash
npm test
```

- 8 suites de prueba
- 54 casos cubiertos
- 0 fallos

## Documentación API (Swagger)

Con el servidor corriendo, acceder a:

```
http://localhost:3000/docs
```

Documentación completa de todos los endpoints con ejemplos de request/response.

## Estructura del proyecto

```
app/
  api/
    auth/           → login, logout, refresh, forgot/reset password
    users/          → registro, perfil, foto, sugerencias, valoraciones
    matches/        → crear, unirse, invitar, cancelar, resultado, valorar
    notifications/  → centro de notificaciones in-app
    ranking/        → leaderboard regional
    admin/          → panel de administración completo
  docs/             → Swagger UI

lib/
  prisma.ts         → cliente Prisma singleton
  jwt.ts            → signToken / verifyToken
  notify.ts         → helper de notificaciones (fire-and-forget)
  elo.ts            → cálculo de MMR con algoritmo ELO (K=32)
  adminGuard.ts     → middleware de autorización para rutas admin

prisma/
  schema.prisma     → modelo de datos completo

__tests__/          → pruebas unitarias Jest
public/
  openapi.json      → especificación OpenAPI 3.0

scripts/            → utilidades (generación de Excel, plan de pruebas)
```

## Endpoints principales

| Módulo | Descripción |
|---|---|
| `POST /api/auth/login` | Inicio de sesión de jugador |
| `POST /api/users` | Registro de nuevo jugador |
| `GET /api/users/suggestions` | Rivales sugeridos por compatibilidad MMR |
| `POST /api/matches` | Crear partido |
| `POST /api/matches/[id]/result` | Registrar resultado y aplicar ELO |
| `GET /api/notifications` | Centro de notificaciones |
| `GET /api/ranking` | Ranking regional |
| `POST /api/admin/login` | Acceso al panel admin |
| `GET /api/admin/metrics` | Métricas de la plataforma |
| `GET /api/admin/audit-logs` | Log de auditoría |

Ver documentación completa en `/docs`.
