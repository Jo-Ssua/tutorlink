import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { requestIdMiddleware } from './common/middleware/request-id.middleware';

export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService);
  const apiPrefix = config.getOrThrow<string>('apiPrefix');
  const corsOrigins = config.getOrThrow<string[]>('corsOrigins');

  app.setGlobalPrefix(apiPrefix);
  app.use(requestIdMiddleware);
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.enableShutdownHooks();
}

export function setupSwagger(app: INestApplication): OpenAPIObject {
  const swaggerConfig = new DocumentBuilder()
    .setTitle('TutorLink API')
    .setDescription(
      [
        'Backend de tutorias universitarias con StudyMatch y pagos simulados.',
        'Todas las respuestas exitosas usan { success, data, meta } y los errores { success, error, meta }.',
        'Autenticacion: Authorization: Bearer <accessToken>.',
      ].join(' '),
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Access token emitido por /auth/login',
      },
      'bearer',
    )
    .addTag('Auth', 'Registro, verificacion, login y refresh')
    .addTag('Catalog', 'Facultades, programas, materias y profesores')
    .addTag('Tutors', 'Busqueda, perfil publico y resenas de tutores')
    .addTag('Tutor', 'Gestion del perfil, disponibilidad e ingresos del tutor')
    .addTag('Bookings', 'Reservas y pagos simulados')
    .addTag('Reviews', 'Resenas de sesiones completadas')
    .addTag('StudyMatch', 'Asignacion automatica de tutores para solicitudes urgentes')
    .addTag('Notifications', 'Notificaciones internas del usuario')
    .addTag('Admin', 'Aprobacion de tutores, materias y metricas')
    .addTag('Health', 'Estado del servicio')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    customSiteTitle: 'TutorLink API',
    jsonDocumentUrl: 'docs-json',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
    },
  });

  return document;
}
