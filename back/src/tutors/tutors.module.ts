import { Module } from '@nestjs/common';
import { TutorController } from './tutor.controller';
import { TutorsController } from './tutors.controller';
import { TutorsService } from './tutors.service';

@Module({
  controllers: [TutorController, TutorsController],
  providers: [TutorsService],
  exports: [TutorsService],
})
export class TutorsModule {}
