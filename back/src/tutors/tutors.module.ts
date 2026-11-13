import { Module } from '@nestjs/common';
import { TutorHistoryController } from './tutor-history.controller';
import { TutorHistoryService } from './tutor-history.service';
import { TutorRequestsController } from './tutor-requests.controller';
import { TutorRequestsService } from './tutor-requests.service';
import { TutorController } from './tutor.controller';
import { TutorsController } from './tutors.controller';
import { TutorsService } from './tutors.service';

@Module({
  controllers: [TutorController, TutorHistoryController, TutorRequestsController, TutorsController],
  providers: [TutorsService, TutorHistoryService, TutorRequestsService],
  exports: [TutorsService],
})
export class TutorsModule {}
