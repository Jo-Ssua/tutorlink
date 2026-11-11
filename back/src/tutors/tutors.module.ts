import { Module } from '@nestjs/common';
import { TutorHistoryController } from './tutor-history.controller';
import { TutorHistoryService } from './tutor-history.service';
import { TutorController } from './tutor.controller';
import { TutorsController } from './tutors.controller';
import { TutorsService } from './tutors.service';

@Module({
  controllers: [TutorController, TutorHistoryController, TutorsController],
  providers: [TutorsService, TutorHistoryService],
  exports: [TutorsService],
})
export class TutorsModule {}
