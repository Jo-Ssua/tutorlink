import { Module } from '@nestjs/common';
import { ScoringService } from './scoring.service';
import { StudyMatchController } from './studymatch.controller';
import { StudyMatchScheduler } from './studymatch.scheduler';
import { StudyMatchService } from './studymatch.service';

@Module({
  controllers: [StudyMatchController],
  providers: [StudyMatchService, ScoringService, StudyMatchScheduler],
  exports: [StudyMatchService, ScoringService],
})
export class StudyMatchModule {}
