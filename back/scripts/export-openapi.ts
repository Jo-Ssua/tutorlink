import 'reflect-metadata';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { configureApp, setupSwagger } from '../src/bootstrap';

async function main(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });
  configureApp(app);
  const document = setupSwagger(app);

  const outputDir = join(process.cwd(), 'docs');
  mkdirSync(outputDir, { recursive: true });
  const outputFile = join(outputDir, 'openapi.json');
  writeFileSync(outputFile, `${JSON.stringify(document, null, 2)}\n`, 'utf8');

  await app.close();
  console.log(`OpenAPI exportado en ${outputFile}`);
}

main().catch((error) => {
  console.error('No fue posible exportar OpenAPI:', error);
  process.exitCode = 1;
});
