import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    // Prisma 7 exige un driver adapter: el cliente ya no abre la conexion por si mismo.
    super({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? '' }) });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Conexion a PostgreSQL establecida');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
