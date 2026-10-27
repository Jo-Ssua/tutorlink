import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import {
  AddTutorSubjectDto,
  ApplyTutorDto,
  AvailabilityQueryDto,
  CreateAvailabilityDto,
  EarningsQueryDto,
  TutorHistoryQueryDto,
  TutorRequestsQueryDto,
  UpdateAvailabilityDto,
  UpdateTutorProfileDto,
} from './dto/tutors.dto';
import { TutorsService } from './tutors.service';

@ApiTags('Tutor')
@ApiBearerAuth()
@Controller('tutor')
export class TutorController {
  constructor(private readonly tutorsService: TutorsService) {}

  @Post('apply')
  @Roles(Role.STUDENT, Role.TUTOR)
  @ApiOperation({ summary: 'Enviar o actualizar la postulacion para ser tutor' })
  apply(@CurrentUser() user: AuthenticatedUser, @Body() dto: ApplyTutorDto) {
    return this.tutorsService.apply(user, dto);
  }

  @Get('profile')
  @Roles(Role.TUTOR)
  @ApiOperation({ summary: 'Consultar el perfil propio del tutor' })
  profile(@CurrentUser() user: AuthenticatedUser) {
    return this.tutorsService.getOwnProfile(user);
  }

  @Patch('profile')
  @Roles(Role.TUTOR)
  @ApiOperation({ summary: 'Editar biografia, tarifa, modalidades y disponibilidad del perfil' })
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateTutorProfileDto,
  ) {
    return this.tutorsService.updateProfile(user, dto);
  }

  @Post('subjects')
  @Roles(Role.TUTOR)
  @ApiOperation({ summary: 'Agregar una materia del pensum pendiente de validacion' })
  addSubject(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddTutorSubjectDto,
  ) {
    return this.tutorsService.addSubject(user, dto);
  }

  @Delete('subjects/:id')
  @Roles(Role.TUTOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retirar una materia del perfil de tutor' })
  removeSubject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) subjectId: string,
  ) {
    return this.tutorsService.removeSubject(user, subjectId);
  }

  @Get('availability')
  @Roles(Role.TUTOR)
  @ApiOperation({ summary: 'Listar las franjas de disponibilidad propias' })
  availability(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AvailabilityQueryDto,
  ) {
    return this.tutorsService.listAvailability(user, query);
  }

  @Post('availability')
  @Roles(Role.TUTOR)
  @ApiOperation({ summary: 'Crear una franja de disponibilidad' })
  createAvailability(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAvailabilityDto,
  ) {
    return this.tutorsService.createAvailability(user, dto);
  }

  @Patch('availability/:id')
  @Roles(Role.TUTOR)
  @ApiOperation({ summary: 'Editar una franja de disponibilidad sin historial asociado' })
  updateAvailability(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) slotId: string,
    @Body() dto: UpdateAvailabilityDto,
  ) {
    return this.tutorsService.updateAvailability(user, slotId, dto);
  }

  @Delete('availability/:id')
  @Roles(Role.TUTOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Eliminar o bloquear una franja de disponibilidad' })
  deleteAvailability(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) slotId: string,
  ) {
    return this.tutorsService.deleteAvailability(user, slotId);
  }

  @Get('dashboard')
  @Roles(Role.TUTOR)
  @ApiOperation({ summary: 'Obtener el panel operativo del tutor' })
  dashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.tutorsService.dashboard(user);
  }

  @Get('requests')
  @Roles(Role.TUTOR)
  @ApiOperation({ summary: 'Listar solicitudes y reservas recibidas' })
  requests(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: TutorRequestsQueryDto,
  ) {
    return this.tutorsService.requests(user, query);
  }

  @Get('history')
  @Roles(Role.TUTOR)
  @ApiOperation({ summary: 'Consultar historial de tutorias con estudiantes anonimizados' })
  history(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: TutorHistoryQueryDto,
  ) {
    return this.tutorsService.history(user, query);
  }

  @Get('earnings')
  @Roles(Role.TUTOR)
  @ApiOperation({ summary: 'Resumen de ingresos simulados por periodo y sesion' })
  earnings(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: EarningsQueryDto,
  ) {
    return this.tutorsService.earnings(user, query);
  }
}
