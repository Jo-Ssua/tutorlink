import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Prisma 7 ya no lee el bloque package.json#prisma ni carga .env por su cuenta.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'ts-node --transpile-only prisma/seed.ts',
  },
  datasource: {
    // env() de Prisma aborta si la variable no existe; con este fallback
    // prisma generate sigue funcionando sin base de datos configurada.
    url: process.env.DATABASE_URL ?? '',
  },
});
