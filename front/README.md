# TutorLink Front

Frontend de TutorLink: acceso por rol, registro con correo institucional y las pantallas de las historias ya implementadas.

Alcance implementado:

- **Inicio y cierre de sesión (SCRUM-5):** login con correo institucional, rutas protegidas por rol, aviso cuando la sesión caduca y cierre de sesión que invalida el token al instante (también en otras pestañas).
- **Registro con correo institucional (SCRUM-6 y SCRUM-7):** formulario con validación del dominio aceptado, indicador de fuerza de contraseña, verificación con código de 6 dígitos, cuenta atrás de 15 minutos, reenvío con espera de 60 s y activación directa desde el enlace del correo.
- **Calificación posterior a una sesión (SCRUM-17):** sesiones `COMPLETED` del estudiante, separadas entre pendientes por calificar y ya calificadas, con estrellas obligatorias de 1 a 5, comentario opcional y publicación anónima.
- **Reserva de tutorías (SCRUM-20 y SCRUM-21):** consulta de disponibilidad y creación de la reserva.
- **Inicio de tutor y panel de administración:** vistas de solo lectura con las sesiones del tutor y las métricas de la plataforma.

Traduce los errores de negocio de la API a mensajes en español y mantiene uniforme el de credenciales inválidas, para no revelar si un correo está registrado.

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

`VITE_INSTITUTIONAL_DOMAINS` lista los dominios que el formulario de registro acepta, separados por coma. Debe coincidir con `INSTITUTIONAL_EMAIL_DOMAINS` del backend, que es quien decide de verdad: en el front solo sirve para avisar antes de enviar.

## Rutas

| Ruta | Acceso | Pantalla |
| --- | --- | --- |
| `/login` | Pública | Inicio de sesión; recuerda la ruta que se intentaba abrir |
| `/registro` | Pública | Registro con correo institucional |
| `/verificar` | Pública | Código de 6 dígitos; el enlace del correo llega con `?email=&code=` y verifica solo |
| `/app/calificaciones` | Estudiante | Calificación de sesiones completadas |
| `/app/reservar` | Estudiante | Disponibilidad y creación de reservas |
| `/app/tutor` | Tutor | Sesiones del tutor e ingresos |
| `/app/admin` | Administrador | Métricas y postulaciones pendientes |

`/` redirige a la pantalla inicial del rol. Entrar a una sección de otro rol devuelve a la propia con un aviso; sin sesión, a `/login`.

## Scripts

| Comando | Descripción |
| --- | --- |
| `npm run dev` | Servidor de desarrollo en el puerto 5173 |
| `npm run build` | Typecheck y build de producción en `dist/` |
| `npm run preview` | Previsualiza el build |
| `npm run typecheck` | Verificación de TypeScript |
| `npm test` | Pruebas con Vitest y Testing Library |
| `npm run test:watch` | Pruebas en modo watch |
| `npm run lint` | Ejecuta ESLint |

## Endpoints usados

| Método | Ruta | Uso |
| --- | --- | --- |
| `POST` | `/auth/register` | Crear la cuenta y disparar el código de verificación |
| `POST` | `/auth/verify-email` | Activar la cuenta con el código |
| `POST` | `/auth/resend-verification` | Pedir un código nuevo |
| `GET` | `/catalog/programs` | Programas académicos del formulario de registro |
| `POST` | `/auth/login` | Obtener los tokens de la sesión |
| `GET` | `/auth/me` | Revalidar la sesión guardada al abrir la app |
| `POST` | `/auth/refresh` | Renovar el access token ante un 401 |
| `POST` | `/auth/logout` | Cerrar la sesión |
| `GET` | `/bookings/my?status=COMPLETED&page=1&limit=20` | Sesiones completadas del estudiante |
| `POST` | `/bookings/:id/review` | Registrar la calificación y actualizar el promedio del tutor |
| `GET` | `/bookings/tutor` | Sesiones del tutor autenticado |
| `GET` | `/admin/stats` | Métricas de la plataforma |
| `GET` | `/admin/tutor-applications?status=PENDING` | Postulaciones por revisar |

El cliente desenvuelve el sobre `{ success, data, meta }` y transforma los errores `{ success: false, error }` en mensajes legibles.

## Estructura

```text
front/
  src/
    api.ts                    Cliente HTTP, refresh token, errores y aviso de sesión caída
    errors.ts                 Mensajes de negocio por código de error de la API
    routes.tsx                Árbol de rutas públicas y protegidas
    session.ts                Persistencia local de la sesión
    types.ts                  Tipos de la API
    auth/
      AuthContext.tsx         Estado de la sesión, login, logout y pantalla inicial por rol
      ProtectedRoute.tsx      Guardas de sesión y de rol
      institutionalEmail.ts   Dominios aceptados y formato que se muestra al usuario
      passwordRules.ts        Reglas de contraseña, iguales a las del backend
    components/
      AuthShell.tsx           Marco de las pantallas sin sesión
      LoginCard.tsx           Formulario de acceso
      TopBar.tsx              Navegación por rol y cierre de sesión
      SessionCard.tsx         Sesión completada, reseña y bloqueos
      ReviewForm.tsx          Estrellas obligatorias, comentario y anonimato
      StarRating.tsx          Selector accesible de 1 a 5 estrellas
    layouts/
      AppLayout.tsx           Barra superior y contenido de las rutas con sesión
    screens/
      LoginScreen.tsx         Ruta /login
      RegisterScreen.tsx      Ruta /registro
      VerifyScreen.tsx        Ruta /verificar
      RatingsScreen.tsx       Ruta /app/calificaciones
      TutorHome.tsx           Ruta /app/tutor
      AdminHome.tsx           Ruta /app/admin
    reservas/                 Reserva de tutorías (SCRUM-20 y SCRUM-21)
    test/renderApp.tsx        Monta la app real con router en memoria y dobles de fetch
    App.tsx                   Router y proveedor de sesión
    styles.css                Diseño responsive
```

Las pruebas viven junto al código que cubren (`*.test.ts` y `*.test.tsx`).

## Verificación manual sugerida

### Registro y sesión

1. Abrir `/registro` y escribir un correo que no sea institucional: la pantalla informa el formato aceptado antes de llamar a la API.
2. Registrar un correo institucional nuevo: la app lleva a `/verificar` con el correo ya puesto.
3. Con `EXPOSE_DEV_CODES=true` en el backend el código aparece en pantalla; si no, está en el log de la API o en Mailpit.
4. Escribir un código incorrecto: el mensaje dice cuántos intentos quedan. Con el correcto, la cuenta queda activa y vuelve a `/login` con el aviso.
5. Abrir el enlace del correo (`/verificar?email=...&code=...`): verifica sin pedir nada más.
6. Iniciar sesión con la contraseña incorrecta: el mensaje es el mismo que con un correo inexistente.
7. Con la sesión abierta, pedir `/app/admin` como estudiante: vuelve a su pantalla con un aviso.
8. Cerrar sesión y volver atrás en el navegador: `/app/...` manda al login.

### Calificación (SCRUM-17)

1. Ejecutar el seed demo de la HU e ingresar con Juan.
2. Confirmar que la sesión demo aparece en “Pendientes por calificar”.
3. Intentar enviar sin estrellas: la UI exige una calificación de 1 a 5.
4. Enviar la calificación con comentario y verificar el mensaje con el nuevo promedio del tutor.
5. Confirmar que la sesión pasa a “Ya calificadas” y que ya no permite una segunda reseña.
6. Ingresar con María: sus sesiones completadas aparecen como ya calificadas y sin acción de envío.

## Reservar tutorías (SCRUM-20 y SCRUM-21)

La pestaña **Reservar tutoría** (visible para estudiantes en la barra superior) vive en `src/reservas/` y usa la misma sesión que el resto de la app. Sus estilos están acotados a la clase `.rsv` para no afectar otras secciones.

- **SCRUM-20 · Consulta de disponibilidad:** calendario mensual con las franjas libres del tutor, filtro por modalidad y actualización automática cada 15 s.
- **SCRUM-21 · Creación de una reserva:** materia, tema o necesidad, modalidad, fecha y hora; resumen de costo; la reserva queda *pendiente de respuesta* del tutor.

Si el puerto 5173 está bloqueado en Windows: `npm run dev -- --port 3001`. Instrucciones generales en el README de la raíz del repositorio.
