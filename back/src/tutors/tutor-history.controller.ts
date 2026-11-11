import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { TutorHistoryQueryDto } from './dto/tutors.dto';
import { TutorHistoryService } from './tutor-history.service';

@ApiTags('Tutor')
@ApiBearerAuth()
@Controller('tutor/history')
export class TutorHistoryController {
  constructor(private readonly history: TutorHistoryService) {}

  @Get()
  @Roles(Role.TUTOR)
  @ApiOperation({
    summary: 'Historial de tutorias del tutor, con filtros por fecha, materia y estado',
    description:
      'Solo lectura. Devuelve fecha, estudiante anonimizado, materia, estado, tarifa y la resena asociada. `to` en formato AAAA-MM-DD incluye todo ese dia.',
  })
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: TutorHistoryQueryDto) {
    return this.history.list(user, query);
  }

  // Debe declararse antes de `:id` para que "summary" no se interprete como un UUID.
  @Get('summary')
  @Roles(Role.TUTOR)
  @ApiOperation({
    summary: 'Resumen de trayectoria: sesiones por estado, calificacion promedio y materias',
  })
  summary(@CurrentUser() user: AuthenticatedUser) {
    return this.history.summary(user);
  }

  @Get(':id')
  @Roles(Role.TUTOR)
  @ApiOperation({ summary: 'Detalle de una sesion del historial, con su calificacion y comentario' })
  detail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) bookingId: string,
  ) {
    return this.history.detail(user, bookingId);
  }
}
