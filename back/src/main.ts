import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp, setupSwagger } from './bootstrap';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);
  const port = config.getOrThrow<number>('port');
  const nodeEnv = config.getOrThrow<string>('nodeEnv');

  configureApp(app);
  setupSwagger(app);
  await app.listen(port, '0.0.0.0');

  const logger = new Logger('Bootstrap');
  logger.log(`TutorLink API escuchando en http://localhost:${port}/${config.getOrThrow<string>('apiPrefix')}`);
  logger.log(`Swagger UI: http://localhost:${port}/docs (${nodeEnv})`);
}

void bootstrap();
