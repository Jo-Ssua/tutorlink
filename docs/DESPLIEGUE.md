# Despliegue · frontend en Vercel, backend en Railway

| Pieza | Dónde | Por qué ahí |
| --- | --- | --- |
| `front/` | Vercel | Compila a estáticos con Vite; no necesita servidor |
| `back/` | Railway | Contenedor con proceso persistente, que es lo que el scheduler de StudyMatch exige |
| PostgreSQL | Railway | Mismo proyecto que la API, conexión por red privada |

## Por qué el backend no va en Vercel

[`back/src/studymatch/studymatch.scheduler.ts`](../back/src/studymatch/studymatch.scheduler.ts) corre
`@Cron(EVERY_30_SECONDS)` sobre un proceso vivo. En serverless no hay proceso entre peticiones, así
que ese cron no existe, y el cron de Vercel no lo reemplaza: en el plan Hobby el mínimo es una vez
al día. Sin ese ciclo, una propuesta urgente que el tutor no responde queda colgada con su franja en
`HELD` hasta que alguien toque la solicitud — justo el criterio de HU12 de relevar al siguiente tutor.

El vencimiento también se evalúa en las rutas
([`studymatch.service.ts:332`](../back/src/studymatch/studymatch.service.ts#L332) y
[`:592`](../back/src/studymatch/studymatch.service.ts#L592)), así que el relevo ocurre si alguien
responde o confirma. Lo que se pierde es el relevo automático sin que nadie abra la app.

## Orden de los pasos

Hay una dependencia circular entre las URL: la API necesita el dominio del frontend para CORS, y el
frontend necesita el de la API. Se resuelve desplegando la API primero y volviendo al final.

### 1. Railway · base de datos y API

En el dashboard de Railway:

1. **New Project → Deploy from GitHub repo**, elegir este repositorio.
2. En el servicio, **Settings → Source → Root Directory**: `back`.
   Railway construye con el Dockerfile en cuanto encuentra uno, y ahí está
   [`back/Dockerfile`](../back/Dockerfile), cuyo contexto de build tiene que ser `back/`.
3. **New → Database → PostgreSQL** en el mismo proyecto.
4. En el servicio de la API, **Variables**: pegar las de la tabla de abajo.
   `DATABASE_URL` se referencia a la base con `${{Postgres.DATABASE_URL}}`.
5. **Settings → Networking → Generate Domain** para obtener la URL pública.
6. **Settings → Deploy → Healthcheck Path**: `/api/v1/health`.

Las migraciones no se corren a mano: [`docker-entrypoint.sh`](../back/docker-entrypoint.sh) ejecuta
`prisma migrate deploy` al arrancar, y después el seed si `SEED_ON_START=true`.

#### Variables de la API

Secretos — generar cada uno con
`node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`:

| Variable | Regla |
| --- | --- |
| `JWT_ACCESS_SECRET` | 32 caracteres o más |
| `JWT_REFRESH_SECRET` | 32 caracteres o más, **distinto** del anterior |
| `EMAIL_CODE_SECRET` | 32 caracteres o más |
| `ANONYMITY_SALT` | Cualquier cadena estable; si cambia, cambian los alias del historial |

Si falta alguno de los dos JWT, o son iguales, o miden menos de 32, la API no arranca:
lo valida [`env.validation.ts`](../back/src/config/env.validation.ts).

Dependientes de URL — se llenan en el paso 3:

| Variable | Valor |
| --- | --- |
| `APP_URL` | URL del frontend en Vercel, con `https://` |
| `CORS_ORIGINS` | La misma URL. Sin esto el navegador bloquea al frontend: el valor por defecto solo admite `localhost` |

Resto:

| Variable | Valor |
| --- | --- |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `NODE_ENV` | `production` |
| `API_PREFIX` | `api/v1` |
| `RUN_MIGRATIONS` | `true` |
| `SEED_ON_START` | `true` — el seed es idempotente, solo hace `upsert` |
| `EXPOSE_DEV_CODES` | `false` |
| `MAIL_TRANSPORT` | `console` |
| `MAIL_FROM` | `TutorLink <no-reply@tutorlink.local>` |
| `INSTITUTIONAL_EMAIL_DOMAINS` | `universidad.edu.co,estudiantes.universidad.edu.co` |
| `PLATFORM_FEE_PERCENT` | `10` |
| `CANCELLATION_WINDOW_HOURS` | `24` |
| `STUDYMATCH_TTL_CRITICAL_MINUTES` | `5` |
| `STUDYMATCH_TTL_HIGH_MINUTES` | `10` |
| `STUDYMATCH_TTL_MEDIUM_MINUTES` | `20` |
| `STUDYMATCH_TTL_LOW_MINUTES` | `30` |
| `STUDYMATCH_STUDENT_CONFIRM_MINUTES` | `10` |

`PORT` no se define: Railway la inyecta y la API la lee de ahí.

### 2. Vercel · frontend

1. **Add New → Project**, importar este repositorio.
2. **Root Directory**: `front`. El resto lo toma de [`front/vercel.json`](../front/vercel.json):
   framework Vite, `npm run build`, salida `dist`, y la rewrite que manda todo a `index.html`.
3. **Environment Variables**:

| Variable | Valor |
| --- | --- |
| `VITE_API_URL` | `https://<dominio-railway>/api/v1` |
| `VITE_INSTITUTIONAL_DOMAINS` | `universidad.edu.co,estudiantes.universidad.edu.co` |

La rewrite no es opcional: [`App.tsx`](../front/src/App.tsx) usa `BrowserRouter`, así que sin ella
entrar directo a `/app/pagos` o recargar ahí devuelve 404.

### 3. Cerrar el círculo

Volver a Railway y poner `APP_URL` y `CORS_ORIGINS` con el dominio de Vercel. Guardar dispara un
redespliegue.

### 4. Verificar

```bash
curl https://<dominio-railway>/api/v1/health
```

```bash
API_URL=https://<dominio-railway>/api/v1 node back/scripts/smoke-test.mjs
```

Después, entrar al frontend e iniciar sesión con un usuario del seed
(`estudiante@universidad.edu.co`, contraseña `TutorLink123*`; el resto está en el README).

## Detalles que muerden

- **`VITE_API_URL` se incrusta en build.** Vite la resuelve al compilar
  ([`api.ts:41`](../front/src/api.ts#L41)), no en runtime. Cambiarla en Vercel exige redeploy.
- **Los correos van a los logs.** Con `MAIL_TRANSPORT=console`, el código de verificación aparece en
  los logs del servicio, no en un buzón. Registrar una cuenta nueva en vivo implica leer los logs.
  Para que el correo salga de verdad: `MAIL_TRANSPORT=smtp` más `SMTP_HOST`, `SMTP_PORT`,
  `SMTP_USER`, `SMTP_PASS`. Los usuarios del seed ya están activos y no necesitan verificación.
- **Swagger queda público** en `https://<dominio-railway>/docs`. Es intencional en este MVP, pero
  conviene saberlo antes de compartir la URL.
- **El README contradice el puerto de Docker local.** `docker compose` publica la API en el 3001
  (`"3001:3000"`), mientras el README y el `.env.example` del front apuntan al 3000. Solo afecta al
  modo local con Docker: ahí hay que poner `VITE_API_URL=http://localhost:3001/api/v1`.

## Configuración como código

[`.railway/railway.ts`](../.railway/railway.ts) declara la base y el servicio de la API, con los
secretos como `preserve()` para que el repositorio no los contenga y el CLI no los sobreescriba.

```bash
npx railway login
npx railway link
npx railway config plan
npx railway config apply
```

Dos cosas que conviene saber:

- **Railway no lee `.railway/` al desplegar.** El archivo lo aplica el CLI; un `git push` no lo
  ejecuta. Si se configura todo por el dashboard, este archivo es documentación.
- **`railway.json` ya no sirve** para servicios nuevos. Railway deprecó Config as Code y los
  servicios nuevos no pueden usarlo; `.railway/railway.ts` (Infrastructure as Code) es el reemplazo.

Si `railway config plan` se queja de que no resuelve `railway/iac`, instalar el paquete
(`npm install railway`) crea un `package.json` en la raíz del repositorio, que hoy no existe porque
`back/` y `front/` son proyectos separados. El camino del dashboard evita eso por completo.

## Alternativa sin hosting

Para mostrarla en clase sin desplegar nada:

```bash
cd back && cp .env.example .env && docker compose up -d --build
```

```bash
cd front && cp .env.example .env && npm install && npm run build && npm run preview
```

Con `VITE_API_URL=http://localhost:3001/api/v1` en `front/.env`, por lo del puerto.
