import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { StudyMatchService } from './studymatch.service';

@Injectable()
export class StudyMatchScheduler {
  private readonly logger = new Logger(StudyMatchScheduler.name);

  constructor(private readonly studyMatchService: StudyMatchService) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async handleExpiredProposals(): Promise<void> {
    try {
      await this.studyMatchService.expireStaleProposals();
    } catch (error) {
      this.logger.error(
        `Fallo el ciclo de expiracion StudyMatch: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
