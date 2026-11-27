FROM node:24-alpine AS build

WORKDIR /app
RUN apk add --no-cache openssl

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.build.json tsconfig.seed.json nest-cli.json prisma.config.ts ./
COPY prisma ./prisma
COPY src ./src

RUN npx prisma generate
RUN npm run build
RUN npm run build:seed

FROM node:24-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache openssl

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-seed ./dist-seed
COPY --from=build /app/prisma ./prisma
COPY package.json ./
# Prisma 7 lee la URL de la base desde prisma.config.ts, no del schema.
# Sin este archivo, `prisma migrate deploy` falla al arrancar el contenedor:
# "The datasource.url property is required in your Prisma config file".
COPY --from=build /app/prisma.config.ts ./
COPY docker-entrypoint.sh ./

RUN sed -i 's/\r$//' docker-entrypoint.sh && chmod +x docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
