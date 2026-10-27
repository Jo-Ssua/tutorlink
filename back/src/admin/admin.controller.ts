import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { AdminService } from './admin.service';
import {
  AdminApplicationsQueryDto,
  AdminSubjectsQueryDto,
  AdminUsersQueryDto,
  RejectTutorApplicationDto,
  RejectTutorSubjectDto,
} from './dto/admin.dto';

@ApiTags('Admin')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('tutor-applications')
  @ApiOperation({ summary: 'Listar postulaciones de tutores y su evidencia' })
  tutorApplications(@Query() query: AdminApplicationsQueryDto) {
    return this.adminService.listTutorApplications(query);
  }

  @Patch('tutor-applications/:id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Aprobar una postulacion y asignar el rol TUTOR' })
  approve(@Param('id', new ParseUUIDPipe()) applicationId: string) {
    return this.adminService.approveTutorApplication(applicationId);
  }

  @Patch('tutor-applications/:id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rechazar una postulacion con motivo visible' })
  reject(
    @Param('id', new ParseUUIDPipe()) applicationId: string,
    @Body() dto: RejectTutorApplicationDto,
  ) {
    return this.adminService.rejectTutorApplication(applicationId, dto);
  }

  @Get('tutor-subjects')
  @ApiOperation({ summary: 'Listar materias de tutores pendientes de validacion' })
  tutorSubjects(@Query() query: AdminSubjectsQueryDto) {
    return this.adminService.listTutorSubjects(query);
  }

  @Patch('tutor-subjects/:id/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verificar una materia agregada por un tutor' })
  verifySubject(@Param('id', new ParseUUIDPipe()) tutorSubjectId: string) {
    return this.adminService.verifyTutorSubject(tutorSubjectId);
  }

  @Patch('tutor-subjects/:id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rechazar la validacion de una materia de tutor' })
  rejectSubject(
    @Param('id', new ParseUUIDPipe()) tutorSubjectId: string,
    @Body() dto: RejectTutorSubjectDto,
  ) {
    return this.adminService.rejectTutorSubject(tutorSubjectId, dto);
  }

  @Get('users')
  @ApiOperation({ summary: 'Listar usuarios por rol, estado o texto' })
  users(@Query() query: AdminUsersQueryDto) {
    return this.adminService.listUsers(query);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Obtener metricas operativas y de ingresos simulados' })
  stats() {
    return this.adminService.stats();
  }
}
