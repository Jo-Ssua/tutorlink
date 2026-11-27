/**
 * Infraestructura de TutorLink en Railway.
 *
 * Solo declara el backend y su base de datos: el frontend vive en Vercel
 * (`front/vercel.json`), porque compila a estaticos y no necesita servidor.
 *
 * Esto NO se aplica con un `git push`: Railway no lee `.railway/` al desplegar.
 * Lo aplica el CLI, y siempre muestra el plan antes de tocar nada:
 *
 *   npx railway login
 *   npx railway link
 *   npx railway config plan
 *   npx railway config apply
 *
 * Los secretos no viven aqui. `preserve()` significa "deja el valor que ya
 * esta puesto en Railway", asi que se cargan una vez en el dashboard del
 * servicio y el CLI no los sobreescribe ni los imprime.
 *
 * Detalle del despliegue en `docs/DESPLIEGUE.md`.
 */
import { defineRailway, github, postgres, preserve, project, service } from 'railway/iac';

const REPO = 'Jo-Ssua/tutorlink';

export default defineRailway(() => {
  const db = postgres('postgres');

  const api = service('api', {
    // `rootDirectory` deja el servicio en `back/`, que es donde esta el
    // Dockerfile y el contexto de build que ese Dockerfile espera.
    source: github(REPO, { branch: 'main', rootDirectory: 'back' }),
    // El prefijo de la API entra en la ruta: `API_PREFIX` es `api/v1`.
    healthcheck: '/api/v1/health',
    env: {
      DATABASE_URL: db.env.DATABASE_URL,

      // Secretos: se cargan en el dashboard, no en el repositorio.
      // JWT_ACCESS_SECRET y JWT_REFRESH_SECRET necesitan 32 caracteres o mas
      // y tienen que ser distintos entre si, o la API no arranca.
      JWT_ACCESS_SECRET: preserve(),
      JWT_REFRESH_SECRET: preserve(),
      EMAIL_CODE_SECRET: preserve(),
      ANONYMITY_SALT: preserve(),

      // Dependen del dominio que Vercel asigne al frontend, asi que tambien
      // se ponen en el dashboard. Sin CORS_ORIGINS el navegador bloquea al
      // frontend: el valor por defecto solo admite localhost.
      APP_URL: preserve(),
      CORS_ORIGINS: preserve(),

      NODE_ENV: 'production',
      API_PREFIX: 'api/v1',

      // El entrypoint del contenedor aplica las migraciones al arrancar.
      // El seed es idempotente (solo `upsert`), asi que puede quedar activo
      // para tener los usuarios de prueba en cada despliegue.
      RUN_MIGRATIONS: 'true',
      SEED_ON_START: 'true',

      // Nunca se exponen los codigos de verificacion: con NODE_ENV=production
      // la API los oculta igual, pero queda explicito.
      EXPOSE_DEV_CODES: 'false',

      // `console` deja los codigos de verificacion en los logs del servicio.
      // Para que lleguen por correo: MAIL_TRANSPORT=smtp y las SMTP_* en el
      // dashboard. Los usuarios del seed ya vienen activos y no los necesitan.
      MAIL_TRANSPORT: 'console',
      MAIL_FROM: 'TutorLink <no-reply@tutorlink.local>',

      INSTITUTIONAL_EMAIL_DOMAINS: 'universidad.edu.co,estudiantes.universidad.edu.co',

      PLATFORM_FEE_PERCENT: '10',
      CANCELLATION_WINDOW_HOURS: '24',

      STUDYMATCH_TTL_CRITICAL_MINUTES: '5',
      STUDYMATCH_TTL_HIGH_MINUTES: '10',
      STUDYMATCH_TTL_MEDIUM_MINUTES: '20',
      STUDYMATCH_TTL_LOW_MINUTES: '30',
      STUDYMATCH_STUDENT_CONFIRM_MINUTES: '10',
    },
  });

  return project('tutorlink', {
    resources: [db, api],
  });
});
