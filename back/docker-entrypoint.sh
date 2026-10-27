#!/bin/sh
set -eu

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "Aplicando migraciones de Prisma..."
  npx prisma migrate deploy
fi

if [ "${SEED_ON_START:-false}" = "true" ]; then
  echo "Ejecutando seed de datos demo..."
  node dist-seed/prisma/seed.js
fi

exec node dist/main.js
