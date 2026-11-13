import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { TutorRequestsService } from './tutor-requests.service';

@ApiTags('Tutor')
@ApiBearerAuth()
@Controller('tutor/requests')
export class TutorRequestsController {
  constructor(private readonly requests: TutorRequestsService) {}

  @Get('dashboard')
  @Roles(Role.TUTOR)
  @ApiOperation({
    summary: 'Panel de solicitudes: pendientes, aceptadas, rechazadas y proximas sesiones',
    description:
      'Solo lectura. Para responder una solicitud usa `POST /bookings/:id/accept` o `POST /bookings/:id/reject`, que notifican al estudiante.',
  })
  dashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.requests.dashboard(user);
  }
}
