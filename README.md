# TutorLink

**Tutorías universitarias entre pares, con perfiles verificados, reservas claras y seguimiento académico.**
TutorLink es una plataforma web que conecta a estudiantes universitarios con tutores pares (estudiantes de semestres superiores que ya aprobaron la materia) dentro de su propia universidad. Nace para reemplazar la búsqueda informal e insegura de tutores (grupos de WhatsApp, videos genéricos, herramientas de IA sin contexto local) por una experiencia centralizada, transparente y confiable, sobre todo en los momentos de presión previos a un parcial.

Proyecto académico de la asignatura Gerencia de Proyectos de TI (Universidad Icesi).

## Qué resuelve
- **Confianza:** tutores verificados por correo institucional y materias aprobadas, con reseñas auténticas posteriores a cada sesión.
- **Pertinencia:** búsqueda por universidad, facultad, materia y profesor, basada en el pensum oficial.
- **Transparencia:** tarifas, comisión, horarios y modalidad visibles antes de confirmar una reserva.
- **Oportunidad:** tutoría de emergencia (StudyMatch) para conseguir apoyo el mismo día.
- **Ingresos para tutores:** panel con solicitudes, agenda, historial e ingresos (simulados en esta fase).

## Funcionalidades
| Área | Descripción |
| --- | --- |
| **Autenticación** | Registro con correo institucional, verificación por código o enlace, login por rol, refresh y cierre de sesión que invalida los tokens al instante (SCRUM-5 a SCRUM-7) |
| Tutores | Postulación, aprobación por administrador, verificación de materias, perfil público |
| Búsqueda | Filtros por facultad, programa, materia, profesor, tarifa, calificación y modalidad |
| **Disponibilidad** | Consulta de franjas libres del tutor, siempre actualizadas (SCRUM-20) |
| **Reservas** | Crear la reserva con materia, tema, modalidad, fecha y hora; aceptación del tutor; pago simulado; cancelación (SCRUM-21) |
| Reseñas | Calificación de 1 a 5 y comentario después de una sesión completada (SCRUM-17) |
| StudyMatch | Asignación automática de tutor para solicitudes urgentes |
| Administración | Aprobación de tutores, métricas y notificaciones |
> Los pagos son **simulados**: no se procesan ni se solicitan datos bancarios reales.

### Flujo de registro y acceso
```text
Estudiante: /registro con su correo institucional -> la API acepta sin decir si el correo ya existía
Correo:     llega un código de 6 dígitos y un enlace, válidos 15 minutos
Estudiante: escribe el código en /verificar, o abre el enlace => cuenta ACTIVA
Estudiante: inicia sesión => entra a la pantalla de su rol
Estudiante: cierra sesión => volver atrás no sirve, hay que autenticarse de nuevo
```
Reglas clave de acceso:
- Solo se aceptan los dominios de `INSTITUTIONAL_EMAIL_DOMAINS`; cualquier otro se rechaza informando el formato aceptado.
- Un correo o una contraseña incorrectos dan el mismo error, así que la API no sirve para averiguar qué correos están registrados.
- Cinco intentos fallidos bloquean la cuenta 15 minutos, además del límite por IP.
- Cinco códigos errados invalidan el código; se piden otro con un minuto de espera entre envíos.

### Flujo de una reserva
```text
Estudiante: elige tutor -> consulta franjas disponibles -> completa materia, tema y modalidad
Tutor:      acepta o rechaza  (si rechaza, la franja se libera)
Estudiante: confirma el pago simulado => reserva CONFIRMADA
Tutor:      marca la sesión como completada => el estudiante puede calificar
```
Reglas clave de disponibilidad:
- Solo se muestran franjas futuras y libres.
- Cuando alguien reserva una franja, deja de estar disponible para los demás (la reserva es atómica en el backend; si dos personas compiten, solo una gana).
- Si el tutor modifica su agenda, los cambios se reflejan para futuras reservas; la pantalla del estudiante se refresca sola cada 15 segundos.

## Arquitectura
```text
tutorlink/
  back/    API REST: NestJS 11 + TypeScript + Prisma 6 + PostgreSQL 16
  front/   Web: React 19 + TypeScript + Vite 7
```
- **Backend** (`back/`): prefijo `api/v1`, documentación Swagger en `/docs`, validación con `class-validator`, autenticación JWT con roles (`STUDENT`, `TUTOR`, `ADMIN`). Detalle en [`back/README.md`](back/README.md) y [`back/README_ENDPOINTS.md`](back/README_ENDPOINTS.md).
- **Frontend** (`front/`): una sola aplicación con dos secciones en la barra superior (visibles para estudiantes):
  - **Calificaciones** (`src/`): calificar sesiones completadas. Ver [`front/README.md`](front/README.md).
  - **Reservar tutoría** (`src/reservas/`): tutor, calendario de disponibilidad, detalles de la reserva y confirmación. Con estilos propios acotados a su sección.

## Requisitos
- Node.js 24 o superior y npm 11
- Docker Desktop (recomendado para PostgreSQL)
- Git

## Cómo ejecutar el proyecto
### 1. Backend
Opción A, todo en Docker (base de datos + API, con migraciones y datos de prueba automáticos):
```bash
cd back
cp .env.example .env
docker compose up -d --build
```
Opción B, API local en modo desarrollo (solo la base de datos en Docker):
```bash
cd back
npm ci
cp .env.example .env
docker compose up -d postgres
npx prisma migrate deploy
npm run prisma:seed
npm run start:dev
```
En Windows PowerShell usa `copy .env.example .env` en lugar de `cp`.
Con el backend arriba:
| Recurso | URL |
| --- | --- |
| API | http://localhost:3000/api/v1 |
| Swagger | http://localhost:3000/docs |
| Health | http://localhost:3000/api/v1/health |

### 2. Frontend
```bash
cd front
cp .env.example .env
npm install
npm run dev
```
Abre http://localhost:5173. Si tu equipo no permite ese puerto, usa `npm run dev -- --port 3001` (el backend ya admite `localhost:3001` y `localhost:5173` en CORS).
`VITE_API_URL` apunta por defecto a `http://localhost:3000/api/v1`.

### 3. Usuarios de prueba
Todos usan la contraseña `TutorLink123*`.
| Rol | Correo |
| --- | --- |
| Estudiante | `estudiante@universidad.edu.co` |
| Estudiante | `juan.estudiante@estudiantes.universidad.edu.co` |
| Tutora (Ana) | `ana.tutor@universidad.edu.co` |
| Tutor (Diego) | `diego.tutor@universidad.edu.co` |
| Tutora (Sofía) | `sofia.tutor@universidad.edu.co` |
| Administrador | `admin@universidad.edu.co` |
Para ver el flujo de reserva: inicia sesión como estudiante, entra a **Reservar tutoría**, elige un tutor y un horario, completa los datos y confirma.
Para probar cambios de agenda del tutor (aún sin pantalla propia), usa Swagger: haz login con un tutor, pulsa **Authorize** y llama a `POST /tutor/availability` o `PATCH /tutor/availability/:id`. La pantalla del estudiante muestra los horarios nuevos en segundos.

### 4. Pruebas y verificación
```bash
cd back
npm run lint
npm test -- --runInBand        # pruebas unitarias
npm run test:e2e               # requiere PostgreSQL con migraciones
node scripts/smoke-test.mjs    # requiere la API corriendo con datos seed
cd ../front
npm run lint
npm test                       # pruebas con Vitest
npm run build                  # typecheck + build de producción
```
## Solución de problemas
| Síntoma | Causa y solución |
| --- | --- |
| `P1000: Authentication failed` al migrar | Otro PostgreSQL (por ejemplo, instalado en Windows) ocupa el puerto 5432. En `back/.env` define `POSTGRES_PORT=5433` y cambia el puerto en `DATABASE_URL` a `5433`; luego `docker compose down && docker compose up -d postgres`. |
| `listen EACCES ... :5173` al iniciar el front | Windows reservó ese rango de puertos. Usa `npm run dev -- --port 3001`, o reinicia WinNAT (`net stop winnat` y `net start winnat` como administrador, con Docker cerrado). |
| Errores de certificado (`UNABLE_TO_VERIFY_LEAF_SIGNATURE`) en `npm install` | En redes con inspección TLS ejecuta antes `$env:NODE_OPTIONS="--use-system-ca"` (PowerShell). |
| `429 RATE_LIMITED` en login | El login admite 10 intentos por minuto; espera un momento. |
| No llega el correo de verificación | Con `MAIL_TRANSPORT=console` (por defecto) el correo se escribe en el log de la API. Para verlo en un buzón: `docker compose --profile mail up -d` y abre http://localhost:8025. |
| No se puede leer el código en pruebas | Pon `EXPOSE_DEV_CODES=true` en `back/.env` (no funciona con `NODE_ENV=production`): la respuesta del registro trae `devVerificationCode`. |
| `401 TOKEN_REVOKED` tras actualizar | Cerrar sesión invalida los tokens anteriores, y la primera vez que se despliega esta versión todos quedan invalidados. Inicia sesión de nuevo. |
| Datos de prueba alterados | Restablece con `docker compose down -v && docker compose up -d --build` en `back/`. |

## Variables de entorno principales
| Variable | Dónde | Descripción |
| --- | --- | --- |
| `DATABASE_URL` | `back/.env` | Conexión a PostgreSQL |
| `POSTGRES_PORT` | `back/.env` | Puerto del host para PostgreSQL en Docker (por defecto `5432`) |
| `CORS_ORIGINS` | `back/.env` | Orígenes permitidos del frontend |
| `PLATFORM_FEE_PERCENT` | `back/.env` | Comisión de la plataforma (por defecto 10 %) |
| `CANCELLATION_WINDOW_HOURS` | `back/.env` | Anticipación mínima para cancelar (por defecto 24 h) |
| `APP_URL` | `back/.env` | URL pública del frontend; base de los enlaces que viajan por correo |
| `INSTITUTIONAL_EMAIL_DOMAINS` | `back/.env` | Dominios de correo aceptados en el registro |
| `MAIL_TRANSPORT` | `back/.env` | `console` escribe el correo en el log; `smtp` lo envía de verdad |
| `EXPOSE_DEV_CODES` | `back/.env` | Devuelve el código de verificación en la respuesta; solo fuera de producción |
| `VITE_API_URL` | `front/.env` | URL base de la API |
| `VITE_INSTITUTIONAL_DOMAINS` | `front/.env` | Dominios que el formulario de registro acepta; debe coincidir con el backend |
La lista completa está en `back/.env.example`.

## Flujo de trabajo del equipo
- Rama principal: `main`; integración: `dev`; cada historia de usuario en su propia rama `feature/...` con Pull Request.
- Historias de usuario gestionadas en Jira (proyecto SCRUM).

## Equipo
Mariana Agudelo Salazar, Victoria Restrepo Balmaceda, Juan Sebastián Rodríguez Legarda, Johan Stiven Suárez Perdomo, Juan José Muñoz Franco y Jean Carlo Ocampo Torres.

## Licencia
Proyecto académico. Uso educativo.