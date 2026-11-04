/**
 * Recorre de punta a punta las dos historias de autenticacion: registro con
 * correo institucional (codigo por correo, activacion, rechazo de dominios
 * ajenos) e inicio y cierre de sesion (error uniforme, acceso por rol, token
 * invalidado al cerrar sesion).
 *
 * Necesita configuracion y base de datos; sin `.env` la aplicacion no arranca:
 *
 *   cp .env.example .env
 *   docker compose up -d db
 *   npm run prisma:deploy
 *   npm run test:e2e
 *
 * El transporte de correo por consola (MAIL_TRANSPORT=console) es suficiente:
 * el codigo se lee de la respuesta, que lo incluye porque el spec enciende
 * EXPOSE_DEV_CODES antes de levantar la aplicacion.
 */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';

// Se enciende antes de importar la configuracion: el registro devuelve el
// codigo y el spec no necesita leer el buzon.
process.env.EXPOSE_DEV_CODES = 'true';

const PASSWORD = 'Segura123';
const API = '/api/v1';

describe('Autenticacion (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let email: string;
  let verificationCode: string;
  let accessToken: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = app.get(PrismaService);
    // Correo distinto en cada corrida: el spec no depende del estado anterior.
    email = `e2e.${Date.now()}@universidad.edu.co`;
  });

  afterAll(async () => {
    if (prisma) {
      // El perfil y las notificaciones caen con el usuario (onDelete: Cascade).
      await prisma.user.deleteMany({ where: { email } });
    }

    await app.close();
  });

  describe('registro con correo institucional', () => {
    it('rechaza un correo no institucional e informa el formato aceptado', async () => {
      const response = await request(app.getHttpServer())
        .post(`${API}/auth/register`)
        .send({ email: 'alguien@gmail.com', password: PASSWORD, fullName: 'Alguien Externo' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NON_INSTITUTIONAL_EMAIL');
      expect(response.body.error.message).toContain('universidad.edu.co');
    });

    it('acepta el correo institucional y entrega un codigo de verificacion', async () => {
      const response = await request(app.getHttpServer())
        .post(`${API}/auth/register`)
        .send({ email, password: PASSWORD, fullName: 'Estudiante E2E' })
        .expect(202);

      expect(response.body.data.verificationRequired).toBe(true);
      expect(response.body.data.devVerificationCode).toMatch(/^\d{6}$/);
      // La respuesta no incluye datos de la cuenta recien creada.
      expect(response.body.data.user).toBeUndefined();

      verificationCode = response.body.data.devVerificationCode;
    });

    it('responde igual si el correo ya estaba registrado', async () => {
      const response = await request(app.getHttpServer())
        .post(`${API}/auth/register`)
        .send({ email, password: 'OtraClave123', fullName: 'Impostor' })
        .expect(202);

      expect(response.body.data.verificationRequired).toBe(true);
      expect(response.body.data.message).toBeDefined();
    });

    it('no deja iniciar sesion antes de verificar el correo', async () => {
      const response = await request(app.getHttpServer())
        .post(`${API}/auth/login`)
        .send({ email, password: PASSWORD })
        .expect(403);

      expect(response.body.error.code).toBe('EMAIL_NOT_VERIFIED');
    });

    it('rechaza un codigo incorrecto', async () => {
      const response = await request(app.getHttpServer())
        .post(`${API}/auth/verify-email`)
        .send({ email, code: '000000' })
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_VERIFICATION_CODE');
    });

    it('activa la cuenta con el codigo correcto', async () => {
      const response = await request(app.getHttpServer())
        .post(`${API}/auth/verify-email`)
        .send({ email, code: verificationCode })
        .expect(200);

      expect(response.body.data.verified).toBe(true);
      expect(response.body.data.user.status).toBe('ACTIVE');
    });

    it('avisa que la cuenta ya esta verificada si se repite el codigo', async () => {
      const response = await request(app.getHttpServer())
        .post(`${API}/auth/verify-email`)
        .send({ email, code: verificationCode })
        .expect(409);

      expect(response.body.error.code).toBe('EMAIL_ALREADY_VERIFIED');
    });
  });

  describe('inicio y cierre de sesion', () => {
    it('devuelve el mismo error para una contrasena incorrecta y un correo inexistente', async () => {
      const wrongPassword = await request(app.getHttpServer())
        .post(`${API}/auth/login`)
        .send({ email, password: 'NoEsLaClave1' })
        .expect(401);

      const unknownEmail = await request(app.getHttpServer())
        .post(`${API}/auth/login`)
        .send({ email: `nadie.${Date.now()}@universidad.edu.co`, password: PASSWORD })
        .expect(401);

      expect(wrongPassword.body.error.code).toBe('INVALID_CREDENTIALS');
      // Mismo codigo y mismo mensaje: nada permite deducir que correos existen.
      expect(unknownEmail.body.error.code).toBe(wrongPassword.body.error.code);
      expect(unknownEmail.body.error.message).toBe(wrongPassword.body.error.message);
    });

    it('entrega los tokens con credenciales validas', async () => {
      const response = await request(app.getHttpServer())
        .post(`${API}/auth/login`)
        .send({ email, password: PASSWORD })
        .expect(200);

      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
      expect(response.body.data.user.role).toBe('STUDENT');
      expect(response.body.data.user.passwordHash).toBeUndefined();

      accessToken = response.body.data.accessToken;
    });

    it('abre una seccion protegida con el access token', async () => {
      const response = await request(app.getHttpServer())
        .get(`${API}/auth/me`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.data.email).toBe(email);
    });

    it('cierra la sesion', async () => {
      const response = await request(app.getHttpServer())
        .post(`${API}/auth/logout`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.data.loggedOut).toBe(true);
    });

    it('exige autenticarse de nuevo tras cerrar sesion, sin esperar a que expire el token', async () => {
      const response = await request(app.getHttpServer())
        .get(`${API}/auth/me`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(401);

      expect(response.body.error.code).toBe('TOKEN_REVOKED');
    });
  });
});
