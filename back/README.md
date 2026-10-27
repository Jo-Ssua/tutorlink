# TutorLink Backend

Backend de TutorLink para gestionar tutorias universitarias, busqueda de tutores, reservas, pagos simulados, resenas y asignacion automatica de tutores mediante StudyMatch.

El proyecto implementa las historias de usuario de `HUs.csv` con NestJS, PostgreSQL y Prisma, e incluye seed demostrativo, Swagger, pruebas y despliegue con Docker Compose.

## Stack

- NestJS 11 + TypeScript
- PostgreSQL 16
- Prisma ORM 6
- JWT access/refresh con Passport
- class-validator / class-transformer
- Swagger / OpenAPI
- Jest + Supertest
- Docker + Docker Compose
- ESLint + Prettier

## Arquitectura

| Modulo | Responsabilidad |
| --- | --- |
| `auth` | Registro institucional, verificacion de correo, login, refresh, logout y perfil autenticado |
| `catalog` | Facultades, programas, materias, profesores y pensum |
| `tutors` | Postulacion, perfil de tutor, materias, disponibilidad, dashboard, historial e ingresos |
| `tutors` (publico) | Busqueda/filtros, perfil publico, disponibilidad y resenas verificadas |
| `bookings` | Cotizacion, reservas, aceptacion/rechazo, pago simulado, cancelacion, finalizacion y resenas |
| `studymatch` | Solicitudes urgentes, scoring, propuestas, aceptacion del tutor, confirmacion del estudiante y expiracion |
| `admin` | Aprobacion de tutores, verificacion de materias, usuarios y metricas |
| `notifications` | Bandeja, contador de no leidas y marcado de leidas |
| `health` | Estado del servicio y conectividad con PostgreSQL |

La API usa el prefijo `api/v1`. Todas las respuestas exitosas siguen el formato:

```json
{
  "success": true,
  "data": {},
  "meta": {
    "timestamp": "2026-10-27T14:00:00.000Z",
    "path": "/api/v1/health",
    "requestId": "uuid",
    "statusCode": 200
  }
}
```

Los errores usan:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "La solicitud contiene datos invalidos",
    "details": ["..."]
  },
  "meta": {
    "timestamp": "2026-10-27T14:00:00.000Z",
    "path": "/api/v1/auth/login",
    "requestId": "uuid",
    "statusCode": 400
  }
}
```

## Requisitos

- Node.js 24 o superior
- npm 11 o superior
- Docker y Docker Compose (recomendado)
- PostgreSQL 16 si se ejecuta sin Docker

## Inicio rapido local

```bash
npm ci
cp .env.example .env
docker compose up -d postgres
npx prisma migrate deploy
npm run prisma:seed
npm run start:dev
```

La API queda disponible en `http://localhost:3000/api/v1`.

Si se prefiere PostgreSQL local en lugar de Docker, ajustar `DATABASE_URL` en `.env` y ejecutar las migraciones y el seed.

## Docker Compose

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f api
```

El servicio `api` aplica migraciones automaticamente y ejecuta el seed demo al iniciar, salvo que se desactive:

```bash
DOCKER_SEED_ON_START=false docker compose up -d --build
```

Para reiniciar la base de datos y volver al estado seed limpio:

```bash
docker compose down -v
docker compose up -d --build
```

El stack expone:

- API: `http://localhost:3000/api/v1`
- Swagger UI: `http://localhost:3000/docs`
- OpenAPI JSON: `http://localhost:3000/docs-json`
- Health: `http://localhost:3000/api/v1/health`
- PostgreSQL: `localhost:5432`, base `tutorlink`, usuario `tutorlink`, password `tutorlink`

El Compose de demo usa `NODE_ENV=development` para permitir la visualizacion de codigos de verificacion con `EXPOSE_DEV_CODES=true`. En un despliegue real usar `NODE_ENV=production` y `EXPOSE_DEV_CODES=false`.

## Credenciales demo

Todos los usuarios usan la contrasena `TutorLink123*`.

| Rol | Correo | Estado |
| --- | --- | --- |
| Administrador | `admin@universidad.edu.co` | Activo |
| Estudiante | `estudiante@universidad.edu.co` | Activo |
| Tutora | `ana.tutor@universidad.edu.co` | Verificada |
| Tutor | `diego.tutor@universidad.edu.co` | Verificado |
| Tutora | `sofia.tutor@universidad.edu.co` | Verificada |
| Postulante | `pedro.tutor@universidad.edu.co` | Pendiente de aprobacion |

El seed crea 7 usuarios, 3 facultades, 4 programas, 6 materias, 4 profesores, 12 franjas de disponibilidad, 4 reservas, 4 pagos, 3 resenas y notificaciones de ejemplo.

## Endpoints principales

Referencia detallada de todos los endpoints: [README_ENDPOINTS.md](./README_ENDPOINTS.md).

### Autenticacion

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| POST | `/api/v1/auth/register` | Registro con correo institucional |
| POST | `/api/v1/auth/verify-email` | Verificacion con codigo de 6 digitos |
| POST | `/api/v1/auth/resend-verification` | Reenvio de codigo |
| POST | `/api/v1/auth/login` | Login con access y refresh token |
| POST | `/api/v1/auth/refresh` | Rotacion de tokens |
| POST | `/api/v1/auth/logout` | Cierre de sesion |
| GET | `/api/v1/auth/me` | Usuario autenticado |

### Catalogo

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| GET | `/api/v1/catalog/faculties` | Facultades |
| GET | `/api/v1/catalog/programs` | Programas |
| GET | `/api/v1/catalog/subjects` | Materias |
| GET | `/api/v1/catalog/professors` | Profesores |
| GET | `/api/v1/catalog/programs/:programId/pensum` | Pensum por programa |

### Tutores publicos

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| GET | `/api/v1/tutors` | Busqueda con filtros y ordenamiento |
| GET | `/api/v1/tutors/:id` | Perfil publico |
| GET | `/api/v1/tutors/:id/availability` | Disponibilidad publica |
| GET | `/api/v1/tutors/:id/reviews` | Resenas verificadas |

Filtros de `/tutors`: `facultyId`, `programId`, `subjectId`, `professorId`, `minRating`, `maxRate`, `modality`, `q`, `sortBy` (`RELEVANCE`, `RATING`, `PRICE`, `AVAILABILITY`), `page`, `limit`.

### Tutor autenticado

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| POST | `/api/v1/tutor/apply` | Postulacion como tutor |
| GET, PATCH | `/api/v1/tutor/profile` | Consultar/actualizar perfil |
| POST | `/api/v1/tutor/subjects` | Agregar materia |
| DELETE | `/api/v1/tutor/subjects/:id` | Eliminar materia |
| GET, POST | `/api/v1/tutor/availability` | Listar/crear disponibilidad |
| PATCH, DELETE | `/api/v1/tutor/availability/:id` | Actualizar/eliminar franja |
| GET | `/api/v1/tutor/dashboard` | Dashboard de solicitudes |
| GET | `/api/v1/tutor/requests` | Solicitudes del tutor |
| GET | `/api/v1/tutor/history` | Historial de sesiones |
| GET | `/api/v1/tutor/earnings` | Ingresos simulados |

### Reservas y resenas

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| POST | `/api/v1/bookings/quote` | Cotizacion con tarifa y comision |
| POST | `/api/v1/bookings` | Crear reserva |
| GET | `/api/v1/bookings/my` | Reservas del estudiante |
| GET | `/api/v1/bookings/tutor` | Reservas del tutor |
| GET | `/api/v1/bookings/:id` | Detalle de reserva |
| POST | `/api/v1/bookings/:id/accept` | Aceptar reserva |
| POST | `/api/v1/bookings/:id/reject` | Rechazar reserva |
| POST | `/api/v1/bookings/:id/payment` | Pago simulado |
| POST | `/api/v1/bookings/:id/cancel` | Cancelar y reembolsar |
| POST | `/api/v1/bookings/:id/complete` | Finalizar sesion |
| POST | `/api/v1/bookings/:id/review` | Calificar sesion completada |

### StudyMatch

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| POST | `/api/v1/studymatch/requests` | Crear solicitud urgente |
| GET | `/api/v1/studymatch/requests/my` | Solicitudes del estudiante |
| GET | `/api/v1/studymatch/requests/:id` | Detalle de solicitud |
| POST | `/api/v1/studymatch/requests/:id/cancel` | Cancelar solicitud |
| POST | `/api/v1/studymatch/requests/:id/retry` | Reintentar busqueda |
| POST | `/api/v1/studymatch/requests/:id/advance` | Avanzar al siguiente candidato |
| GET | `/api/v1/studymatch/proposals/pending` | Propuestas pendientes del tutor |
| POST | `/api/v1/studymatch/proposals/:id/respond` | Aceptar o rechazar propuesta |
| POST | `/api/v1/studymatch/proposals/:id/confirm` | Confirmar y pagar propuesta aceptada |

### Administracion

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| GET | `/api/v1/admin/tutor-applications` | Postulaciones de tutores |
| PATCH | `/api/v1/admin/tutor-applications/:id/approve` | Aprobar postulacion |
| PATCH | `/api/v1/admin/tutor-applications/:id/reject` | Rechazar postulacion |
| GET | `/api/v1/admin/tutor-subjects` | Materias por verificar |
| PATCH | `/api/v1/admin/tutor-subjects/:id/verify` | Verificar materia |
| PATCH | `/api/v1/admin/tutor-subjects/:id/reject` | Rechazar materia |
| GET | `/api/v1/admin/users` | Usuarios |
| GET | `/api/v1/admin/stats` | Metricas globales |

### Notificaciones y salud

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| GET | `/api/v1/notifications` | Bandeja paginada |
| GET | `/api/v1/notifications/unread-count` | Contador de no leidas |
| PATCH | `/api/v1/notifications/read-all` | Marcar todas como leidas |
| PATCH | `/api/v1/notifications/:id/read` | Marcar una como leida |
| GET | `/api/v1/health` | Estado y conectividad de base de datos |

## StudyMatch

El flujo de tutoría de emergencia funciona asi:

1. El estudiante crea una solicitud indicando materia, profesor opcional, tema, urgencia, modalidad y ventana de disponibilidad.
2. El sistema descarta tutores no verificados, inactivos, sin la materia verificada, sin disponibilidad compatible o con carga semanal completa.
3. Calcula un score y envia una propuesta al mejor candidato.
4. El tutor acepta o rechaza. Si acepta, se crea una reserva en estado `ACCEPTED` y la franja queda reservada.
5. El estudiante confirma la propuesta y realiza el pago simulado. La reserva pasa a `CONFIRMED`.
6. Si el tutor rechaza o la propuesta expira, el sistema libera la franja y avanza al siguiente candidato.
7. Un cron cada 30 segundos expira propuestas vencidas.

Puntaje:

| Factor | Peso | Criterio |
| --- | --- | --- |
| Profesor preferido | 35 | Coincidencia con el profesor indicado |
| Calificacion | 30 | Rating del tutor |
| Disponibilidad | 25 | Proximidad de la franja a la ventana solicitada |
| Carga semanal | 10 | Menor carga respecto al maximo semanal |

Vigencias por urgencia:

| Urgencia | TTL de propuesta |
| --- | --- |
| `CRITICAL` | 5 minutos |
| `HIGH` | 10 minutos |
| `MEDIUM` | 20 minutos |
| `LOW` | 30 minutos |

El estudiante tiene 10 minutos para confirmar una propuesta aceptada. Solo puede existir una solicitud StudyMatch activa por estudiante.

## Pagos y reservas

- Los pagos son simulados; no se procesan datos bancarios reales.
- La comision de plataforma por defecto es 10% y se suma al subtotal para el estudiante.
- `tutorEarnings` corresponde al subtotal de la sesion.
- Los ingresos del tutor solo contabilizan pagos `APPROVED` de reservas `COMPLETED`.
- La cancelacion del estudiante esta permitida hasta 24 horas antes del inicio y genera reembolso `REFUNDED`.
- El tutor puede rechazar una reserva indicando motivo; la franja se libera.
- Las resenas solo se permiten sobre reservas `COMPLETED` y una vez por reserva.

## Variables de entorno

| Variable | Descripcion |
| --- | --- |
| `NODE_ENV` | Entorno (`development`, `production`) |
| `PORT` | Puerto de la API, por defecto `3000` |
| `API_PREFIX` | Prefijo global, por defecto `api/v1` |
| `DATABASE_URL` | Cadena de conexion PostgreSQL |
| `JWT_ACCESS_SECRET` | Secreto de access token, minimo 32 caracteres |
| `JWT_ACCESS_EXPIRES_IN` | Vigencia del access token |
| `JWT_REFRESH_SECRET` | Secreto de refresh token, minimo 32 caracteres y distinto al access |
| `JWT_REFRESH_EXPIRES_IN` | Vigencia del refresh token |
| `EMAIL_CODE_SECRET` | Secreto para codigos de verificacion |
| `ANONYMITY_SALT` | Sal para alias anonimos de estudiantes |
| `INSTITUTIONAL_EMAIL_DOMAINS` | Dominios permitidos para registro |
| `CORS_ORIGINS` | Origenes permitidos, separados por coma |
| `PLATFORM_FEE_PERCENT` | Porcentaje de comision |
| `CANCELLATION_WINDOW_HOURS` | Ventana de cancelacion del estudiante |
| `STUDYMATCH_TTL_*_MINUTES` | TTL de propuestas por urgencia |
| `STUDYMATCH_STUDENT_CONFIRM_MINUTES` | Tiempo para confirmar propuesta |
| `STUDYMATCH_WEIGHT_*` | Pesos del scoring |
| `EXPOSE_DEV_CODES` | Expone codigos de verificacion solo fuera de produccion |
| `SEED_ON_START` | Uso local; no afecta Docker Compose |
| `DOCKER_SEED_ON_START` | Ejecuta seed al iniciar el contenedor, por defecto `true` |

Ver `.env.example` para los valores completos.

## Scripts

| Comando | Descripcion |
| --- | --- |
| `npm run start:dev` | API en modo desarrollo con watch |
| `npm run start:prod` | API compilada |
| `npm run build` | Compila NestJS |
| `npm run build:seed` | Compila el seed para Docker |
| `npm run lint` | Ejecuta ESLint |
| `npm run lint:fix` | Corrige lint automaticamente |
| `npm run format` | Formatea con Prettier |
| `npm test -- --runInBand` | Pruebas unitarias |
| `npm run test:e2e` | Pruebas e2e con Supertest |
| `npm run test:cov` | Cobertura |
| `npm run prisma:generate` | Genera Prisma Client |
| `npm run prisma:migrate` | Crea/aplica migracion en desarrollo |
| `npm run prisma:deploy` | Aplica migraciones |
| `npm run prisma:seed` | Ejecuta seed demo |
| `npm run openapi:export` | Genera `docs/openapi.json` |

## Pruebas

```bash
npm run lint
npm run build
npm test -- --runInBand
npm run test:e2e
node scripts/smoke-test.mjs
```

- `npm test` ejecuta las pruebas unitarias de `src/`.
- `npm run test:e2e` requiere PostgreSQL disponible y migraciones aplicadas.
- `scripts/smoke-test.mjs` requiere la API en `http://localhost:3000/api/v1` y datos seed. Se puede cambiar con `API_URL`.
- El smoke test crea solicitudes, reservas y pagos; ejecutar `docker compose down -v && docker compose up -d --build` o `npx prisma migrate reset --force` para volver al estado limpio.
- El login tiene limite de 10 solicitudes por minuto; si se repite el smoke test inmediatamente puede devolver `429 RATE_LIMITED`.

## Estructura del proyecto

```text
src/
  admin/            Modulo de administracion
  auth/             Autenticacion y verificacion
  bookings/         Reservas, pagos y resenas
  catalog/          Catalogo academico
  common/           DTOs, filtros, guards, interceptores y utilidades
  config/           Configuracion y validacion de entorno
  health/           Healthcheck
  notifications/    Notificaciones
  prisma/           PrismaService y modulo
  studymatch/       Matching, propuestas, scoring y scheduler
  tutors/           Tutores publicos y privados
  app.module.ts     Modulo raiz
  bootstrap.ts      Configuracion global y Swagger
  main.ts           Punto de entrada
prisma/
  migrations/       Migraciones SQL
  schema.prisma     Modelo de datos
  seed.ts           Datos demo idempotentes
scripts/
  export-openapi.ts Generador de OpenAPI
  smoke-test.mjs    Prueba de humo end-to-end
test/
  app.e2e-spec.ts   Pruebas e2e
  jest-e2e.json     Configuracion Jest e2e
docs/
  openapi.json      Contrato OpenAPI generado
```

## Cobertura de historias de usuario

| Epica | Historias | Implementacion |
| --- | --- | --- |
| Autenticacion y verificacion | SCRUM-5 a SCRUM-7 | Registro institucional, codigo, login, refresh, logout |
| Postulacion y aprobacion de tutores | SCRUM-8, SCRUM-9 | `tutor/apply`, panel admin de postulaciones |
| Busqueda y filtros | SCRUM-10 a SCRUM-13 | `GET /tutors` con filtros y ordenamiento |
| Perfiles y resenas | SCRUM-14 a SCRUM-18 | Perfil publico, disponibilidad, resenas verificadas |
| Reservas y gestion de sesiones | SCRUM-19 a SCRUM-23 | Cotizacion, reserva, aceptacion, pago, cancelacion |
| StudyMatch | SCRUM-24 a SCRUM-28 | Solicitud urgente, scoring, propuestas, confirmacion |
| Panel del tutor | SCRUM-29 a SCRUM-34 | Dashboard, disponibilidad, historial, ingresos, notificaciones |

## Notas

- No se envian correos reales. Los codigos de verificacion se devuelven en la respuesta solo si `EXPOSE_DEV_CODES=true` y `NODE_ENV` no es `production`.
- Los tutores ven alias anonimos de estudiantes; las resenas publicas no exponen identidad.
- El seed es idempotente mediante `upsert`, pero no elimina datos creados por pruebas. Para un estado limpio usar `prisma migrate reset` o `docker compose down -v`.
- Swagger permite autenticarse con el boton `Authorize` usando el access token.
- `docs/openapi.json` se regenera con `npm run openapi:export` y actualmente documenta 59 rutas.
- Prisma muestra un aviso de deprecacion por `package.json#prisma`; es compatible con Prisma 6 y puede migrarse a `prisma.config.ts` en una version futura.

## Licencia

Proyecto academico. Uso educativo.
