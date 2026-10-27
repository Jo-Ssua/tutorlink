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
| POST | `/auth/register` | Publico | Registro con correo institucional | `fullName`, `email`, `password`, `studentCode?`, `programId?`, `semester?` |
| POST | `/auth/verify-email` | Publico | Verificar cuenta con codigo | `email`, `code` |
| POST | `/auth/resend-verification` | Publico | Reenviar codigo | `email` |
| POST | `/auth/login` | Publico | Iniciar sesion | `email`, `password` |
| POST | `/auth/refresh` | Publico | Rotar access y refresh token | `refreshToken` |
| POST | `/auth/logout` | Autenticado | Cerrar sesion | - |
| GET | `/auth/me` | Autenticado | Consultar usuario actual | - |

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
| GET | `/tutors/:id/availability` | Franjas disponibles | `from?`, `to?`, `modality?` |
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

---

## Tutor autenticado

| Metodo | Ruta | Rol | Descripcion | Body / Query |
| --- | --- | --- | --- | --- |
| POST | `/tutor/apply` | `STUDENT`, `TUTOR` | Postularse como tutor | `bio?`, `experienceYears`, `hourlyRate`, `modalities`, `subjects`, `professorIds?` |
| GET | `/tutor/profile` | `TUTOR` | Consultar perfil propio | - |
| PATCH | `/tutor/profile` | `TUTOR` | Actualizar perfil | `bio?`, `experienceYears?`, `hourlyRate?`, `modalities?`, `maxWeeklySessions?`, `isActive?` |
| POST | `/tutor/subjects` | `TUTOR` | Agregar materia | `subjectId`, `evidenceUrl?` |
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
  "bio": "Tutora de estructuras de datos",
  "experienceYears": 2,
  "hourlyRate": 45000,
  "modalities": ["VIRTUAL", "IN_PERSON"],
  "subjects": [
    {
      "subjectId": "30000000-0000-4000-8000-000000000001",
      "evidenceUrl": "https://ejemplo.com/evidencia.pdf"
    }
  ],
  "professorIds": ["40000000-0000-4000-8000-000000000001"]
}
```

---

## Reservas

| Metodo | Ruta | Rol | Descripcion | Body / Query |
| --- | --- | --- | --- | --- |
| POST | `/bookings/quote` | `STUDENT` | Cotizar una franja | `tutorProfileId`, `slotId` |
| POST | `/bookings` | `STUDENT` | Crear reserva | `tutorProfileId`, `slotId`, `subjectId`, `topic`, `description?` |
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
  "description": "Necesito repasar arboles AVL y grafos."
}
```

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

El login permite 10 solicitudes por minuto. El limite general es 120 solicitudes por minuto.

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
