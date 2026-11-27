# Despliegue

Tres caminos, de más simple a más manual:

| Opción | Qué hace | Cuándo usarla |
| --- | --- | --- |
| **A · Render** | Un `render.yaml` crea base, API y frontend | Recomendada: un solo proveedor, un solo archivo |
| **B · Vercel + Railway** | Frontend en Vercel, API y base en Railway | Si ya hay cuenta con saldo en Railway |
| **C · Local** | Todo en Docker en la máquina propia | Para mostrarla en clase sin cuentas ni costos |

## Por qué el backend necesita un proceso vivo

[`back/src/studymatch/studymatch.scheduler.ts`](../back/src/studymatch/studymatch.scheduler.ts) corre
`@Cron(EVERY_30_SECONDS)` sobre un proceso vivo. En serverless no hay proceso entre peticiones, así
que ese cron no existe, y el cron de Vercel no lo reemplaza: en el plan Hobby el mínimo es una vez
al día. Sin ese ciclo, una propuesta urgente que el tutor no responde queda colgada con su franja en
`HELD` hasta que alguien toque la solicitud — justo el criterio de HU12 de relevar al siguiente tutor.

El vencimiento también se evalúa en las rutas
([`studymatch.service.ts:332`](../back/src/studymatch/studymatch.service.ts#L332) y
[`:592`](../back/src/studymatch/studymatch.service.ts#L592)), así que el relevo ocurre si alguien
responde o confirma. Lo que se pierde es el relevo automático sin que nadie abra la app.

Esto importa también en Render: un servicio gratuito se duerme a los 15 minutos sin tráfico, y
dormido tampoco ejecuta el cron. Al despertar lo retoma, y el relevo perezoso de las rutas sigue
cubriendo el caso. Para una demo en vivo basta abrir la app un minuto antes.

## Opción A · Render

[`render.yaml`](../render.yaml) en la raíz del repositorio declara los tres recursos y los conecta
entre sí. Render lo llama *Blueprint*; no hace falta CLI.

| Recurso | Nombre | Tipo |
| --- | --- | --- |
| Base de datos | `tutorlink-db` | PostgreSQL 16, plan gratuito |
| API | `tutorlink-api` | Web service con el Dockerfile de `back/` |
| Frontend | `tutorlink-web` | Sitio estático con el build de `front/` |

### Pasos

1. [dashboard.render.com](https://dashboard.render.com) → **New → Blueprint**.
2. Conectar el repositorio y elegir la rama `main`.
3. **Apply**. Render crea los tres recursos, genera los secretos y resuelve `DATABASE_URL` solo.
4. Esperar a que la API quede en *Live*. El primer despliegue construye la imagen Docker completa,
   así que tarda varios minutos.

Las migraciones no se corren a mano: [`docker-entrypoint.sh`](../back/docker-entrypoint.sh) ejecuta
`prisma migrate deploy` al arrancar, y después el seed si `SEED_ON_START=true`. El seed es
idempotente — solo hace `upsert` — así que puede quedar activo en cada despliegue.

### Revisar los dominios después del primer Apply

El `render.yaml` da por hecho que Render asigna `https://tutorlink-api.onrender.com` y
`https://tutorlink-web.onrender.com`. Si alguno de esos subdominios ya está tomado, Render le añade
un sufijo y hay que corregir tres variables:

| Servicio | Variable | Valor correcto |
| --- | --- | --- |
| `tutorlink-api` | `APP_URL` | URL real del frontend |
| `tutorlink-api` | `CORS_ORIGINS` | La misma URL. Sin esto el navegador bloquea al frontend |
| `tutorlink-web` | `VITE_API_URL` | URL real de la API, con `/api/v1` al final |

`VITE_API_URL` se incrusta al compilar, así que cambiarla exige **redesplegar** el frontend, no solo
reiniciarlo.

### Límites del plan gratuito

- **La API se duerme** a los 15 minutos sin tráfico; despertarla tarda cerca de un minuto. El primer
  acceso después de un rato se siente lento.
- **La base caduca 30 días** después de crearse, con 14 días de gracia para pasarla a un plan pago
  antes de que Render la borre con todos sus datos. Para una entrega de curso alcanza; para algo
  permanente, no.
- **1 GB de almacenamiento** fijo, sin backups y sin pool de conexiones administrado.
- **Solo una base gratuita activa** por workspace. Si ya hay otra, hay que borrarla o pagar.
- **750 horas de instancia gratis** al mes por workspace. Un servicio solo no las agota.
- **El sitio estático no se duerme** ni consume esas horas.

### Verificar

```bash
curl https://tutorlink-api.onrender.com/api/v1/health
```

```bash
API_URL=https://tutorlink-api.onrender.com/api/v1 node back/scripts/smoke-test.mjs
```

Después, entrar al frontend e iniciar sesión con un usuario del seed
(`estudiante@universidad.edu.co`, contraseña `TutorLink123*`; el resto está en el README).

## Opción B · Vercel + Railway

| Pieza | Dónde |
| --- | --- |
| `front/` | Vercel, con [`front/vercel.json`](../front/vercel.json) |
| `back/` + PostgreSQL | Railway, mismo proyecto, conexión por red privada |

Hay una dependencia circular entre las URL: la API necesita el dominio del frontend para CORS, y el
frontend el de la API. Se resuelve desplegando la API primero y volviendo al final.

### 1. Railway · base de datos y API

1. **New Project → Deploy from GitHub repo**, elegir este repositorio.
2. En el servicio, **Settings → Source → Root Directory**: `back`.
   Railway construye con el Dockerfile en cuanto encuentra uno, y ahí está
   [`back/Dockerfile`](../back/Dockerfile), cuyo contexto de build tiene que ser `back/`.
3. **New → Database → PostgreSQL** en el mismo proyecto.
4. En el servicio de la API, **Variables**: pegar las de las tablas de abajo.
5. **Settings → Networking → Generate Domain** para obtener la URL pública.
6. **Settings → Deploy → Healthcheck Path**: `/api/v1/health`.

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

En Render esto no se hace a mano: `render.yaml` los declara con `generateValue: true` y Render
genera 256 bits aleatorios la primera vez.

Dependientes de URL — se llenan al final, con el dominio de Vercel:

| Variable | Valor |
| --- | --- |
| `APP_URL` | URL del frontend, con `https://` |
| `CORS_ORIGINS` | La misma URL. Sin esto el navegador bloquea al frontend: el valor por defecto solo admite `localhost` |

Resto:

| Variable | Valor |
| --- | --- |
| `DATABASE_URL` | Referencia a la base de Railway |
| `NODE_ENV` | `production` |
| `API_PREFIX` | `api/v1` |
| `RUN_MIGRATIONS` | `true` |
| `SEED_ON_START` | `true` |
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

`PORT` no se define en ningún proveedor: lo inyecta la plataforma y la API lo lee de ahí
([`configuration.ts:108`](../back/src/config/configuration.ts#L108)).

### 2. Vercel · frontend

1. **Add New → Project**, importar este repositorio.
2. **Root Directory**: `front`. El resto lo toma de [`front/vercel.json`](../front/vercel.json):
   framework Vite, `npm run build`, salida `dist`, y la rewrite que manda todo a `index.html`.
3. **Environment Variables**: `VITE_API_URL` con `https://<dominio-railway>/api/v1`, y
   `VITE_INSTITUTIONAL_DOMAINS` con `universidad.edu.co,estudiantes.universidad.edu.co`.

La rewrite no es opcional: [`App.tsx`](../front/src/App.tsx) usa `BrowserRouter`, así que sin ella
entrar directo a `/app/pagos` o recargar ahí devuelve 404.

### 3. Cerrar el círculo

Volver a Railway y poner `APP_URL` y `CORS_ORIGINS` con el dominio de Vercel. Guardar dispara un
redespliegue. Verificar igual que en la opción A, cambiando el dominio.

### Configuración como código

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

## Opción C · Local

Para mostrarla sin desplegar nada. Los puertos son configurables porque los de por defecto
(5432 y 3001) chocan a menudo con otros proyectos:

```bash
cd back && cp .env.example .env && API_PORT=3005 POSTGRES_PORT=5433 docker compose up -d --build
```

```bash
cd front && VITE_API_URL=http://localhost:3005/api/v1 npm install && npm run build && npm run preview
```

El frontend queda en `http://localhost:5173`, que ya está en el `CORS_ORIGINS` del compose. Para
bajarlo: `docker compose down`. Si los puertos por defecto están libres, se pueden omitir las dos
variables y usar `http://localhost:3001/api/v1`.

Conviene comprobar antes qué puertos están ocupados, porque el error de Docker al chocar es poco
claro (`ports are not available`):

```powershell
Get-NetTCPConnection -State Listen | Select-Object -ExpandProperty LocalPort | Sort-Object -Unique
```

Esto **no sirve** para compartir un link: `localhost` resuelve en la máquina de quien abre la
página, no en la tuya. Un frontend desplegado apuntando a `localhost` buscaría la API en el
computador del visitante.

## Detalles que muerden

- **`VITE_API_URL` se incrusta en build.** Vite la resuelve al compilar
  ([`api.ts:41`](../front/src/api.ts#L41)), no en runtime. Cambiarla exige redeploy del frontend en
  cualquier proveedor.
- **Los correos van a los logs.** Con `MAIL_TRANSPORT=console`, el código de verificación aparece en
  los logs del servicio, no en un buzón. Registrar una cuenta nueva en vivo implica leer los logs.
  Para que el correo salga de verdad: `MAIL_TRANSPORT=smtp` más `SMTP_HOST`, `SMTP_PORT`,
  `SMTP_USER`, `SMTP_PASS`. Los usuarios del seed ya están activos y no necesitan verificación.
- **Swagger queda público** en `https://<dominio>/docs`. Es intencional en este MVP, pero conviene
  saberlo antes de compartir la URL.
- **`plan: free` de la base en `render.yaml` está sin confirmar** contra la tabla de planes de la
  referencia oficial de Render. Si el Apply lo rechaza, es la única línea que hay que cambiar: al
  borrarla Render usa su plan por defecto, que es pago.
- **La base gratuita de Render se conecta por red interna.** Si la API no logra alcanzarla, usar la
  *External Database URL* del dashboard como `DATABASE_URL`.
