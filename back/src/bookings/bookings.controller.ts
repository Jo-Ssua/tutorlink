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
import { BookingsService } from './bookings.service';
import {
  BookingListQueryDto,
  CancelBookingDto,
  CreateBookingDto,
  QuoteBookingDto,
  RejectBookingDto,
  SimulatedPaymentDto,
} from './dto/bookings.dto';

@ApiTags('Bookings')
@ApiBearerAuth()
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post('quote')
  @Roles(Role.STUDENT)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cotizar una reserva con tarifa, cargos simulados y total' })
  quote(@Body() dto: QuoteBookingDto) {
    return this.bookingsService.quote(dto);
  }

  @Post()
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Crear una reserva pendiente sobre una franja disponible' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateBookingDto) {
    return this.bookingsService.create(user, dto);
  }

  @Get('my')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Listar las reservas del estudiante autenticado' })
  myBookings(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: BookingListQueryDto,
  ) {
    return this.bookingsService.listMine(user, query);
  }

  @Get('tutor')
  @Roles(Role.TUTOR)
  @ApiOperation({ summary: 'Listar las reservas recibidas por el tutor' })
  tutorBookings(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: BookingListQueryDto,
  ) {
    return this.bookingsService.listForTutor(user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar el detalle de una reserva' })
  detail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) bookingId: string,
  ) {
    return this.bookingsService.getById(user, bookingId);
  }

  @Post(':id/accept')
  @Roles(Role.TUTOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Aceptar una solicitud de reserva' })
  accept(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) bookingId: string,
  ) {
    return this.bookingsService.accept(user, bookingId);
  }

  @Post(':id/reject')
  @Roles(Role.TUTOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rechazar una solicitud de reserva y liberar la franja' })
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) bookingId: string,
    @Body() dto: RejectBookingDto,
  ) {
    return this.bookingsService.reject(user, bookingId, dto);
  }

  @Post(':id/payment')
  @Roles(Role.STUDENT)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirmar el pago simulado de una reserva aceptada' })
  confirmPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) bookingId: string,
    @Body() dto: SimulatedPaymentDto,
  ) {
    return this.bookingsService.confirmPayment(user, bookingId, dto);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancelar una reserva segun la politica de cancelacion' })
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) bookingId: string,
    @Body() dto: CancelBookingDto,
  ) {
    return this.bookingsService.cancel(user, bookingId, dto);
  }

  @Post(':id/complete')
  @Roles(Role.TUTOR, Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Marcar una sesion confirmada como completada' })
  complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) bookingId: string,
  ) {
    return this.bookingsService.complete(user, bookingId);
  }
}
