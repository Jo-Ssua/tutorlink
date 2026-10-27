import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import {
  ConfirmProposalDto,
  CreateStudyMatchRequestDto,
  RespondProposalDto,
  StudyMatchRequestListQueryDto,
} from './dto/studymatch.dto';
import { StudyMatchService } from './studymatch.service';

@ApiTags('StudyMatch')
@ApiBearerAuth()
@Controller('studymatch')
export class StudyMatchController {
  constructor(private readonly studyMatchService: StudyMatchService) {}

  @Post('requests')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Crear una solicitud urgente e iniciar la asignacion automatica' })
  createRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateStudyMatchRequestDto,
  ) {
    return this.studyMatchService.createRequest(user, dto);
  }

  @Get('requests/my')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Listar las solicitudes StudyMatch del estudiante' })
  myRequests(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: StudyMatchRequestListQueryDto,
  ) {
    return this.studyMatchService.myRequests(user, query);
  }

  @Get('requests/:id')
  @ApiOperation({ summary: 'Consultar una solicitud StudyMatch y sus propuestas' })
  request(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) requestId: string,
  ) {
    return this.studyMatchService.getRequest(user, requestId);
  }

  @Post('requests/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancelar una solicitud StudyMatch activa' })
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) requestId: string,
  ) {
    return this.studyMatchService.cancelRequest(user, requestId);
  }

  @Post('requests/:id/retry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reintentar la asignacion cuando no habia tutores disponibles' })
  retry(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) requestId: string,
  ) {
    return this.studyMatchService.retryRequest(user, requestId);
  }

  @Post('requests/:id/advance')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Expirar manualmente la propuesta activa y avanzar al siguiente candidato',
  })
  advance(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) requestId: string,
  ) {
    return this.studyMatchService.advanceRequest(user, requestId);
  }

  @Get('proposals/pending')
  @Roles(Role.TUTOR)
  @ApiOperation({ summary: 'Listar propuestas urgentes pendientes de respuesta del tutor' })
  pendingProposals(@CurrentUser() user: AuthenticatedUser) {
    return this.studyMatchService.pendingProposals(user);
  }

  @Post('proposals/:id/respond')
  @Roles(Role.TUTOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Aceptar o rechazar una propuesta urgente' })
  respond(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) proposalId: string,
    @Body() dto: RespondProposalDto,
  ) {
    return this.studyMatchService.respondProposal(user, proposalId, dto);
  }

  @Post('proposals/:id/confirm')
  @Roles(Role.STUDENT)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Aceptar o rechazar la propuesta del tutor y confirmar pago simulado',
  })
  confirm(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) proposalId: string,
    @Body() dto: ConfirmProposalDto,
  ) {
    return this.studyMatchService.confirmProposal(user, proposalId, dto);
  }
}
