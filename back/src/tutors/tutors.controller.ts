import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import { AvailabilityQueryDto, TutorSearchQueryDto } from './dto/tutors.dto';
import { TutorsService } from './tutors.service';

@ApiTags('Tutors')
@Public()
@Controller('tutors')
export class TutorsController {
  constructor(private readonly tutorsService: TutorsService) {}

  @Get()
  @ApiOperation({
    summary: 'Buscar tutores por facultad, programa, materia, profesor, tarifa y calificacion',
  })
  search(@Query() query: TutorSearchQueryDto) {
    return this.tutorsService.search(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar el perfil publico de un tutor verificado' })
  profile(@Param('id', new ParseUUIDPipe()) tutorProfileId: string) {
    return this.tutorsService.publicProfile(tutorProfileId);
  }

  @Get(':id/availability')
  @ApiOperation({ summary: 'Consultar franjas disponibles de un tutor' })
  availability(
    @Param('id', new ParseUUIDPipe()) tutorProfileId: string,
    @Query() query: AvailabilityQueryDto,
  ) {
    return this.tutorsService.publicAvailability(tutorProfileId, query);
  }

  @Get(':id/reviews')
  @ApiOperation({ summary: 'Consultar resenas verificadas y anonimizadas de un tutor' })
  reviews(
    @Param('id', new ParseUUIDPipe()) tutorProfileId: string,
    @Query() query: PaginationDto,
  ) {
    return this.tutorsService.publicReviews(tutorProfileId, query.page, query.limit);
  }
}
