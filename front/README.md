# TutorLink Front · SCRUM-17

Frontend de la historia de usuario **“Calificación posterior a una sesión”** (SCRUM-17).

Alcance implementado:

- Lista únicamente las sesiones del estudiante autenticado con estado `COMPLETED`.
- Separa las sesiones **pendientes por calificar** de las **ya calificadas**.
- Permite enviar una calificación obligatoria de **1 a 5 estrellas** y un comentario opcional de hasta 2000 caracteres.
- Permite publicar la reseña como anónima.
- Bloquea la acción si la sesión no está completada o si ya tiene reseña (validación en UI y en la API).
- Actualiza en pantalla la reseña y el promedio/cantidad de reseñas del tutor tras un envío exitoso.
- Traduce los errores de negocio de la API (`BOOKING_NOT_COMPLETED`, `REVIEW_ALREADY_EXISTS`, `BOOKING_NOT_FOUND`, `VALIDATION_ERROR`).

No implementa otras historias de usuario (autenticación completa, historial general, búsqueda, reservas, pagos, etc.). El formulario de acceso es el mínimo necesario para obtener un token de estudiante y probar esta HU.

## Stack

- React 19 + TypeScript
- Vite 7
- CSS propio, sin framework de UI
- Consumo de la API NestJS existente (`/api/v1`)

## Requisitos

- Node.js 24 o superior
- Backend de `back/` corriendo en `http://localhost:3000/api/v1`
- PostgreSQL con migraciones y seed del backend

## Correr el proyecto

### 1. Backend

Desde la raíz del repositorio:

```bash
cd back
npm ci
cp .env.example .env
docker compose up -d postgres
npx prisma migrate deploy
npm run prisma:seed
npm run start:dev
```

También se puede levantar todo con Docker:

```bash
cd back
docker compose up -d --build
```

### 2. Datos demo para esta HU

El seed general deja todas las reservas completadas ya calificadas. Para probar el envío de una calificación nueva, ejecuta el seed aislado de esta HU:

```bash
cd back
npx ts-node --transpile-only scripts/seed-rating-demo.ts
```

Este script es idempotente y solo crea/actualiza una franja, una reserva completada, su pago simulado y elimina la reseña de **esa reserva demo** para dejarla pendiente. No modifica las reservas ni reseñas de las demás historias.

Cuenta demo resultante:

| Rol | Correo | Contraseña |
| --- | --- | --- |
| Estudiante (Juan) | `juan.estudiante@estudiantes.universidad.edu.co` | `TutorLink123*` |

También se puede ingresar con `estudiante@universidad.edu.co` para ver sesiones ya calificadas.

### 3. Frontend

```bash
cd front
npm install
cp .env.example .env
npm run dev
```

Abrir `http://localhost:5173`.

La variable `VITE_API_URL` apunta por defecto a `http://localhost:3000/api/v1`. El backend ya permite CORS desde `http://localhost:5173`.

## Scripts

| Comando | Descripción |
| --- | --- |
| `npm run dev` | Servidor de desarrollo en el puerto 5173 |
| `npm run build` | Typecheck y build de producción en `dist/` |
| `npm run preview` | Previsualiza el build |
| `npm run typecheck` | Verificación de TypeScript |

## Endpoints usados

| Método | Ruta | Uso |
| --- | --- | --- |
| `POST` | `/auth/login` | Obtener tokens de estudiante |
| `POST` | `/auth/refresh` | Renovar el access token ante un 401 |
| `POST` | `/auth/logout` | Cerrar la sesión |
| `GET` | `/bookings/my?status=COMPLETED&page=1&limit=20` | Sesiones completadas del estudiante |
| `POST` | `/bookings/:id/review` | Registrar la calificación y actualizar el promedio del tutor |

El cliente desenvuelve el sobre `{ success, data, meta }` y transforma los errores `{ success: false, error }` en mensajes legibles.

## Estructura

```text
front/
  src/
    api.ts                    Cliente HTTP, refresh token y errores
    errors.ts                 Mensajes de negocio de la HU
    session.ts                Persistencia local de la sesión
    types.ts                  Tipos de la API
    components/
      LoginCard.tsx           Acceso mínimo de estudiante
      SessionCard.tsx         Sesión completada, reseña y bloqueos
      ReviewForm.tsx          Estrellas obligatorias, comentario y anonimato
      StarRating.tsx          Selector accesible de 1 a 5 estrellas
    App.tsx                   Carga de sesiones y actualización tras calificar
    styles.css                Diseño responsive
```

## Verificación manual sugerida

1. Ejecutar el seed demo de la HU e ingresar con Juan.
2. Confirmar que la sesión demo aparece en “Pendientes por calificar”.
3. Intentar enviar sin estrellas: la UI exige una calificación de 1 a 5.
4. Enviar la calificación con comentario y verificar el mensaje con el nuevo promedio del tutor.
5. Confirmar que la sesión pasa a “Ya calificadas” y que ya no permite una segunda reseña.
6. Ingresar con María: sus sesiones completadas aparecen como ya calificadas y sin acción de envío.
