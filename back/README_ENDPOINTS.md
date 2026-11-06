# TutorLink API - Referencia de endpoints

Documento enfocado en el contrato HTTP. Para instalación, Docker, seed y pruebas ver `README.md`.

## Base URL

```text
http://localhost:3000/api/v1
```

Swagger interactivo: `http://localhost:3000/docs`  
OpenAPI JSON: `http://localhost:3000/docs-json`

## Convenciones

### Autenticacion

Los endpoints protegidos requieren:

```http
Authorization: Bearer <accessToken>
Content-Type: application/json
```

El access token se obtiene en `POST /auth/login`. El refresh token se usa en `POST /auth/refresh`.

### Roles

| Rol | Descripcion |
| --- | --- |
| `STUDENT` | Estudiante |
| `TUTOR` | Tutor verificado |
| `ADMIN` | Administrador |
| Publico | No requiere token |
| Autenticado | Cualquier usuario con token valido |
| Dueno/Admin | El recurso debe pertenecer al usuario o ser administrador |

### Formato de respuesta

Exito:

```json
{
  "success": true,
  "data": {},
  "meta": {
    "timestamp": "2026-10-27T14:00:00.000Z",
    "path": "/api/v1/...",
    "requestId": "uuid",
    "statusCode": 200
  }
}
```

Error:

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
    "path": "/api/v1/...",
    "requestId": "uuid",
    "statusCode": 400
  }
}
```

### Paginacion

Los listados aceptan `page` (default `1`) y `limit` (default `20`, maximo `100`) y responden:

```json
{
  "items": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 0,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

### Enums principales

| Enum | Valores |
| --- | --- |
| `Modality` | `IN_PERSON`, `VIRTUAL`, `HYBRID` |
| `Urgency` | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` |
| `BookingStatus` | `PENDING`, `ACCEPTED`, `REJECTED`, `CONFIRMED`, `COMPLETED`, `CANCELLED` |
| `TutoringRequestStatus` | `SEARCHING`, `PROPOSAL_SENT`, `AWAITING_STUDENT`, `CONFIRMED`, `NO_TUTORS`, `CANCELLED`, `EXPIRED` |
| `VerificationStatus` | `PENDING`, `VERIFIED`, `REJECTED` |
| `PaymentStatus` | `PENDING`, `APPROVED`, `REFUNDED`, `FAILED` |
| `EarningsGroupBy` | `DAY`, `WEEK`, `MONTH` |

---

## Autenticacion

| Metodo | Ruta | Rol | Descripcion | Body |
| --- | --- | --- | --- | --- |
| POST | `/auth/register` | Publico | Registro con correo institucional (202) | `fullName`, `email`, `password`, `studentCode?`, `programId?`, `semester?` |
| POST | `/auth/verify-email` | Publico | Verificar cuenta con codigo | `email`, `code` |
| GET | `/auth/verify-email` | Publico | Verificar desde el enlace del correo | query `email`, `code` |
| POST | `/auth/resend-verification` | Publico | Reenviar codigo | `email` |
| POST | `/auth/login` | Publico | Iniciar sesion | `email`, `password` |
| POST | `/auth/refresh` | Publico | Rotar access y refresh token | `refreshToken` |
| POST | `/auth/logout` | Autenticado | Cerrar sesion en todos los dispositivos | - |
| GET | `/auth/me` | Autenticado | Consultar usuario actual | - |

### Registro y verificacion

`POST /auth/register` responde `202 Accepted` con la misma forma exista o no una
cuenta con ese correo, para que la API no sirva como lista de correos
registrados. El correo es el unico canal que distingue los casos: una cuenta
nueva o pendiente recibe un codigo de 6 digitos y un enlace, y una cuenta ya
activa recibe un aviso de que la cuenta existe.

```json
{
  "email": "nueva@universidad.edu.co",
  "verificationRequired": true,
  "verificationExpiresAt": "2026-11-03T18:15:00.000Z",
  "message": "Revisa tu correo institucional para continuar con la activacion de tu cuenta."
}
```

Reglas del codigo:

- Vale 15 minutos y se consume al usarlo.
- Cinco intentos fallidos lo invalidan: hay que pedir otro.
- Entre dos envios al mismo correo hay 60 segundos de espera.
- Con `EXPOSE_DEV_CODES=true` (nunca en produccion) la respuesta agrega
  `devVerificationCode`, para probar sin leer el buzon.

El enlace del correo apunta a `APP_URL` + `MAIL_VERIFICATION_PATH`
(`/verificar?email=...&code=...`), que el frontend resuelve; `GET
/auth/verify-email` acepta los mismos parametros para verificar sin frontend.

Si `INSTITUTIONAL_DOMAIN_FACULTIES` esta configurado, el `programId` debe
pertenecer a una de las facultades habilitadas para el dominio del correo
(`PROGRAM_NOT_IN_DOMAIN_SCOPE`).

### Inicio y cierre de sesion

`POST /auth/login` devuelve siempre `401 INVALID_CREDENTIALS` cuando el correo
no existe, la contrasena es incorrecta o la cuenta esta bloqueada: ninguno de
los tres casos se distingue por codigo, mensaje ni tiempo de respuesta. Cinco
intentos fallidos bloquean la cuenta 15 minutos, lo que complementa el limite
por IP del throttler.

Con la contrasena correcta si se informa el motivo real del rechazo, porque
quien pregunta ya demostro ser el dueno de la cuenta: `403 EMAIL_NOT_VERIFIED`
o `403 ACCOUNT_SUSPENDED`.

`POST /auth/logout` borra el refresh token e incrementa `tokenVersion`, que
viaja en el claim `tv` de cada token: los access tokens ya emitidos dejan de
valer de inmediato (`401 TOKEN_REVOKED`) en vez de seguir vivos hasta expirar.
El modelo guarda un solo refresh token por usuario, asi que cerrar sesion la
cierra en todos los dispositivos.

Ejemplo de login:

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "estudiante@universidad.edu.co",
  "password": "TutorLink123*"
}
```

```json
{
  "accessToken": "jwt",
  "refreshToken": "jwt",
  "tokenType": "Bearer",
  "expiresIn": "15m",
  "refreshExpiresIn": "7d",
  "user": {
    "id": "uuid",
    "email": "estudiante@universidad.edu.co",
    "fullName": "Estudiante Demo",
    "role": "STUDENT"
  }
}
```

---

## Catalogo academico

Todos son publicos.

| Metodo | Ruta | Descripcion | Query |
| --- | --- | --- | --- |
| GET | `/catalog/faculties` | Listar facultades | - |
| GET | `/catalog/programs` | Listar programas | `facultyId?`, `programId?`, `subjectId?`, `search?` |
| GET | `/catalog/subjects` | Listar materias | `facultyId?`, `programId?`, `subjectId?`, `search?` |
| GET | `/catalog/professors` | Listar profesores | `facultyId?`, `programId?`, `subjectId?`, `search?` |
| GET | `/catalog/programs/:programId/pensum` | Consultar pensum | - |

---

## Tutores publicos

Todos son publicos.

| Metodo | Ruta | Descripcion | Query |
| --- | --- | --- | --- |
| GET | `/tutors` | Buscar tutores | Ver filtros abajo |
| GET | `/tutors/:id` | Perfil publico del tutor | - |
| GET | `/tutors/:id/availability` | Franjas disponibles (solo futuras y `AVAILABLE`; respuesta sin cache, incluye `durationMinutes`) | `from?`, `to?`, `modality?` |
| GET | `/tutors/:id/reviews` | Resenas verificadas | `page?`, `limit?` |

Filtros de `GET /tutors`:

| Parametro | Tipo | Descripcion |
| --- | --- | --- |
| `facultyId` | UUID | Facultad |
| `programId` | UUID | Programa |
| `subjectId` | UUID | Materia |
| `professorId` | UUID | Profesor |
| `minRating` | number 0-5 | Calificacion minima |
| `maxRate` | number | Tarifa maxima por hora |
| `modality` | enum | `IN_PERSON`, `VIRTUAL`, `HYBRID` |
| `q` | string | Texto libre |
| `sortBy` | enum | `RELEVANCE`, `RATING`, `PRICE`, `AVAILABILITY` |
| `page` | int | Pagina |
| `limit` | int | Tamano de pagina |

Ejemplo:

```http
GET /api/v1/tutors?subjectId=30000000-0000-4000-8000-000000000001&modality=VIRTUAL&sortBy=AVAILABILITY
```

Cada resultado incluye nombre, `verificationStatus`, materias verificadas, `hourlyRate`, `averageRating`, `reviewCount`, `nextAvailableAt` e `isAvailable`, para comparar tutores sin abrir el perfil.

---

## Tutor autenticado

| Metodo | Ruta | Rol | Descripcion | Body / Query |
| --- | --- | --- | --- | --- |
| POST | `/tutor/apply` | `STUDENT`, `TUTOR` | Postularse como tutor | `programId`, `semester`, `studentCode`, `bio?`, `experienceYears`, `hourlyRate`, `modalities`, `subjects`, `professorIds?` |
| GET | `/tutor/application` | `STUDENT`, `TUTOR` | Consultar perfil academico y postulacion propia | - |
| GET | `/tutor/profile` | `TUTOR` | Consultar perfil propio | - |
| PATCH | `/tutor/profile` | `TUTOR` | Actualizar perfil | `bio?`, `experienceYears?`, `hourlyRate?`, `modalities?`, `maxWeeklySessions?`, `isActive?` |
| POST | `/tutor/subjects` | `TUTOR` | Agregar materia | `subjectId`, `evidenceUrl?` o `grade` + `approvedSemester` |
| DELETE | `/tutor/subjects/:id` | `TUTOR` | Eliminar materia | - |
| GET | `/tutor/availability` | `TUTOR` | Listar disponibilidad | `from?`, `to?`, `modality?` |
| POST | `/tutor/availability` | `TUTOR` | Crear franja | `startAt`, `endAt`, `modality` |
| PATCH | `/tutor/availability/:id` | `TUTOR` | Actualizar franja | `startAt?`, `endAt?`, `modality?` |
| DELETE | `/tutor/availability/:id` | `TUTOR` | Eliminar franja | - |
| GET | `/tutor/dashboard` | `TUTOR` | Dashboard de solicitudes | - |
| GET | `/tutor/requests` | `TUTOR` | Solicitudes recibidas | `status?`, `page?`, `limit?` |
| GET | `/tutor/history` | `TUTOR` | Historial de sesiones | `from?`, `to?`, `subjectId?`, `status?`, `page?`, `limit?` |
| GET | `/tutor/earnings` | `TUTOR` | Ingresos simulados | `from?`, `to?`, `groupBy?` (`DAY`, `WEEK`, `MONTH`) |

Estructura de `subjects` en `POST /tutor/apply`:

```json
{
  "programId": "20000000-0000-4000-8000-000000000001",
  "semester": 5,
  "studentCode": "20231002",
  "bio": "Tutora de estructuras de datos",
  "experienceYears": 2,
  "hourlyRate": 45000,
  "modalities": ["VIRTUAL", "IN_PERSON"],
  "subjects": [
    {
      "subjectId": "30000000-0000-4000-8000-000000000001",
      "evidenceUrl": "https://ejemplo.com/evidencia.pdf"
    },
    {
      "subjectId": "30000000-0000-4000-8000-000000000002",
      "grade": 4.5,
      "approvedSemester": 4
    }
  ],
  "professorIds": ["40000000-0000-4000-8000-000000000001"]
}
```

Cada materia debe incluir `evidenceUrl` o, en su lugar, `grade` (minimo 3.0) y `approvedSemester`. Una materia que no exista en el catalogo oficial responde `404 SUBJECT_NOT_FOUND` y no se registra. `programId` tambien debe existir en el catalogo.

---

## Reservas

| Metodo | Ruta | Rol | Descripcion | Body / Query |
| --- | --- | --- | --- | --- |
| POST | `/bookings/quote` | `STUDENT` | Cotizar una franja | `tutorProfileId`, `slotId` |
| POST | `/bookings` | `STUDENT` | Crear reserva | `tutorProfileId`, `slotId`, `subjectId`, `topic`, `modality` (`VIRTUAL` o `IN_PERSON`), `description?` |
| GET | `/bookings/my` | `STUDENT` | Reservas del estudiante | `status?`, `from?`, `to?`, `page?`, `limit?` |
| GET | `/bookings/tutor` | `TUTOR` | Reservas del tutor | `status?`, `from?`, `to?`, `page?`, `limit?` |
| GET | `/bookings/:id` | Autenticado | Detalle de reserva | - |
| POST | `/bookings/:id/accept` | `TUTOR` | Aceptar reserva | - |
| POST | `/bookings/:id/reject` | `TUTOR` | Rechazar reserva | `reason?` |
| POST | `/bookings/:id/payment` | `STUDENT` | Pago simulado | `simulatePayment: true` |
| POST | `/bookings/:id/cancel` | Autenticado | Cancelar y reembolsar | `reason?` |
| POST | `/bookings/:id/complete` | `TUTOR`, `ADMIN` | Finalizar sesion | - |
| POST | `/bookings/:id/review` | `STUDENT` | Calificar reserva completada | `rating`, `comment?`, `isAnonymous?` |

Flujo de una reserva normal:

```text
POST /bookings -> PENDING
POST /bookings/:id/accept -> ACCEPTED
POST /bookings/:id/payment -> CONFIRMED
POST /bookings/:id/complete -> COMPLETED
POST /bookings/:id/review -> resena creada
```

Ejemplo de creacion:

```json
{
  "tutorProfileId": "50000000-0000-4000-8000-000000000001",
  "slotId": "a0000000-0000-4000-8000-000000000001",
  "subjectId": "30000000-0000-4000-8000-000000000001",
  "topic": "Preparacion para el parcial de estructuras de datos",
  "modality": "VIRTUAL",
  "description": "Necesito repasar arboles AVL y grafos."
}
```

Reglas de `POST /bookings` (SCRUM-21):

- La reserva queda en `PENDING` (pendiente de respuesta del tutor). El tutor la acepta y luego el estudiante confirma el pago simulado.
- La `modality` debe ser compatible con la franja: franja `VIRTUAL` solo admite `VIRTUAL`, `IN_PERSON` solo `IN_PERSON` y `HYBRID` admite cualquiera de las dos (`MODALITY_NOT_AVAILABLE` en caso contrario).
- Si faltan datos obligatorios responde `400 VALIDATION_ERROR` con `error.details` (mensajes en espanol) y `error.fields` (mapa `campo -> mensajes`) para identificar los campos pendientes.
- Si la franja ya fue tomada responde `409 SLOT_NOT_AVAILABLE`; si el estudiante ya tiene una reserva activa que se cruza responde `409 STUDENT_BOOKING_OVERLAP`.

El pago es simulado; no se reciben datos bancarios. La comision se calcula en la cotizacion.

---

## StudyMatch

| Metodo | Ruta | Rol | Descripcion | Body / Query |
| --- | --- | --- | --- | --- |
| POST | `/studymatch/requests` | `STUDENT` | Crear solicitud urgente | Ver body abajo |
| GET | `/studymatch/requests/my` | `STUDENT` | Solicitudes del estudiante | `status?`, `page?`, `limit?` |
| GET | `/studymatch/requests/:id` | Autenticado | Detalle y propuestas | - |
| POST | `/studymatch/requests/:id/cancel` | Autenticado | Cancelar solicitud activa | - |
| POST | `/studymatch/requests/:id/retry` | Autenticado | Reintentar busqueda | - |
| POST | `/studymatch/requests/:id/advance` | Autenticado | Expirar propuesta y avanzar | - |
| GET | `/studymatch/proposals/pending` | `TUTOR` | Propuestas pendientes | - |
| POST | `/studymatch/proposals/:id/respond` | `TUTOR` | Aceptar o rechazar propuesta | `action`, `reason?` |
| POST | `/studymatch/proposals/:id/confirm` | `STUDENT` | Confirmar propuesta y pagar | `accept`, `simulatePayment?`, `rejectionReason?` |

Body de creacion:

```json
{
  "subjectId": "30000000-0000-4000-8000-000000000001",
  "professorId": "40000000-0000-4000-8000-000000000001",
  "topic": "Parcial de estructuras de datos manana",
  "description": "Necesito repasar arboles AVL.",
  "urgency": "CRITICAL",
  "modality": "VIRTUAL",
  "availableFrom": "2026-10-27T15:00:00.000Z",
  "availableTo": "2026-10-27T21:00:00.000Z"
}
```

Responder propuesta:

```json
{
  "action": "ACCEPT",
  "reason": ""
}
```

Confirmar propuesta:

```json
{
  "accept": true,
  "simulatePayment": true
}
```

Flujo:

```text
POST /studymatch/requests -> PROPOSAL_SENT
POST /studymatch/proposals/:id/respond { action: ACCEPT } -> booking ACCEPTED
POST /studymatch/proposals/:id/confirm { accept: true, simulatePayment: true } -> CONFIRMED
```

Si el tutor rechaza o la propuesta expira, el sistema avanza automaticamente al siguiente candidato. Un cron cada 30 segundos expira propuestas vencidas.

---

## Administracion

Todos requieren rol `ADMIN`.

| Metodo | Ruta | Descripcion | Body / Query |
| --- | --- | --- | --- |
| GET | `/admin/tutor-applications` | Listar postulaciones | `status?` (default `PENDING`), `search?`, `page?`, `limit?` |
| PATCH | `/admin/tutor-applications/:id/approve` | Aprobar postulacion | - |
| PATCH | `/admin/tutor-applications/:id/reject` | Rechazar postulacion | `reason` obligatorio |
| GET | `/admin/tutor-subjects` | Listar materias por verificar | `status?` (default `PENDING`), `page?`, `limit?` |
| PATCH | `/admin/tutor-subjects/:id/verify` | Verificar materia | - |
| PATCH | `/admin/tutor-subjects/:id/reject` | Rechazar materia | `reason?` |
| GET | `/admin/users` | Listar usuarios | `role?`, `status?`, `search?`, `page?`, `limit?` |
| GET | `/admin/stats` | Metricas globales | - |

Aprobar una postulacion:

```text
PATCH /api/v1/admin/tutor-applications/:id/approve
Authorization: Bearer <token-admin>
```

Esto actualiza el rol del usuario a `TUTOR`, verifica su perfil y sus materias.

---

## Notificaciones

| Metodo | Ruta | Rol | Descripcion | Query |
| --- | --- | --- | --- | --- |
| GET | `/notifications` | Autenticado | Listar notificaciones | `unreadOnly?`, `page?`, `limit?` |
| GET | `/notifications/unread-count` | Autenticado | Contar no leidas | - |
| PATCH | `/notifications/read-all` | Autenticado | Marcar todas como leidas | - |
| PATCH | `/notifications/:id/read` | Autenticado | Marcar una como leida | - |

---

## Salud

| Metodo | Ruta | Rol | Descripcion |
| --- | --- | --- | --- |
| GET | `/health` | Publico | Estado del servicio y base de datos |

Contenido de `data`:

```json
{
  "status": "ok",
  "database": "up",
  "latencyMs": 3,
  "uptimeSeconds": 120,
  "timestamp": "2026-10-27T14:00:00.000Z",
  "version": "1.0.0"
}
```

---

## Codigos de error comunes

| Codigo HTTP | Codigo interno | Causa |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Body o query invalido |
| 401 | `UNAUTHORIZED` | Token ausente, invalido o expirado |
| 403 | `FORBIDDEN` | Rol o propietario incorrecto |
| 404 | `NOT_FOUND` | Recurso inexistente |
| 409 | `CONFLICT` | Franja ocupada, solicitud activa duplicada, etc. |
| 429 | `RATE_LIMITED` | Limite de solicitudes excedido |

Propios de autenticacion:

| Codigo HTTP | Codigo interno | Causa |
| --- | --- | --- |
| 400 | `NON_INSTITUTIONAL_EMAIL` | El dominio del correo no es institucional; el mensaje lista los aceptados |
| 400 | `PROGRAM_NOT_IN_DOMAIN_SCOPE` | El programa no pertenece a las facultades habilitadas para el dominio |
| 400 | `INVALID_VERIFICATION_CODE` | Codigo incorrecto; `details` dice cuantos intentos quedan |
| 400 | `VERIFICATION_CODE_EXPIRED` | El codigo paso de 15 minutos |
| 400 | `VERIFICATION_ATTEMPTS_EXCEEDED` | Cinco intentos fallidos; el codigo quedo invalidado |
| 401 | `INVALID_CREDENTIALS` | Correo inexistente, contrasena incorrecta o cuenta bloqueada |
| 401 | `TOKEN_REVOKED` | El access token quedo invalidado al cerrar sesion |
| 401 | `REFRESH_TOKEN_REVOKED` | El refresh token ya no corresponde a la sesion vigente |
| 403 | `EMAIL_NOT_VERIFIED` | Credenciales correctas, cuenta sin verificar |
| 403 | `ACCOUNT_SUSPENDED` | Credenciales correctas, cuenta suspendida |
| 409 | `EMAIL_ALREADY_VERIFIED` | La cuenta ya estaba activa |

El login permite 10 solicitudes por minuto y el reenvio de codigo 5. El limite
general es 120 solicitudes por minuto.

## Credenciales demo

Password: `TutorLink123*`

| Rol | Email |
| --- | --- |
| Admin | `admin@universidad.edu.co` |
| Estudiante | `estudiante@universidad.edu.co` |
| Tutora | `ana.tutor@universidad.edu.co` |
| Tutor | `diego.tutor@universidad.edu.co` |
| Tutora | `sofia.tutor@universidad.edu.co` |
| Postulante pendiente | `pedro.tutor@universidad.edu.co` |
