import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingStatus, Prisma } from '@prisma/client';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { anonymizeStudentId } from '../common/utils/anonymize';
import { money } from '../common/utils/money';
import { PrismaService } from '../prisma/prisma.service';

/** Cuantas solicitudes trae cada bloque del panel. El total real va en `counts`. */
const BLOCK_SIZE = 20;

const requestInclude = {
  subject: { select: { id: true, code: true, name: true } },
} as const;

type RequestRow = Prisma.BookingGetPayload<{ include: typeof requestInclude }>;

/**
 * Panel de solicitudes del tutor.
 *
 * Solo lee: aceptar y rechazar siguen siendo `POST /bookings/:id/accept|reject`, que ademas
 * avisan al estudiante. El estudiante siempre se devuelve como alias anonimo.
 */
@Injectable()
export class TutorRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async dashboard(user: AuthenticatedUser) {
    const now = new Date();
    const mine = { tutorId: user.id };
    const upcomingWhere: Prisma.BookingWhereInput = {
      ...mine,
      status: BookingStatus.CONFIRMED,
      startAt: { gt: now },
    };

    const find = (
      where: Prisma.BookingWhereInput,
      orderBy: Prisma.BookingOrderByWithRelationInput,
    ) =>
      this.prisma.booking.findMany({
        where,
        orderBy,
        take: BLOCK_SIZE,
        include: requestInclude,
      });

    const [pending, accepted, rejected, upcoming, counts] = await Promise.all([
      // Lo mas urgente primero: la sesion que empieza antes.
      find({ ...mine, status: BookingStatus.PENDING }, { startAt: 'asc' }),
      find({ ...mine, status: BookingStatus.ACCEPTED }, { startAt: 'asc' }),
      find({ ...mine, status: BookingStatus.REJECTED }, { updatedAt: 'desc' }),
      find(upcomingWhere, { startAt: 'asc' }),
      Promise.all([
        this.prisma.booking.count({
          where: { ...mine, status: BookingStatus.PENDING },
        }),
        this.prisma.booking.count({
          where: { ...mine, status: BookingStatus.ACCEPTED },
        }),
        this.prisma.booking.count({
          where: { ...mine, status: BookingStatus.REJECTED },
        }),
        this.prisma.booking.count({ where: upcomingWhere }),
      ]),
    ]);

    return {
      counts: {
        pending: counts[0],
        accepted: counts[1],
        rejected: counts[2],
        upcoming: counts[3],
      },
      pending: pending.map((row) => this.mapRequest(row, now)),
      accepted: accepted.map((row) => this.mapRequest(row, now)),
      rejected: rejected.map((row) => this.mapRequest(row, now)),
      upcoming: upcoming.map((row) => this.mapRequest(row, now)),
    };
  }

  private mapRequest(booking: RequestRow, now: Date) {
    return {
      id: booking.id,
      studentAlias: anonymizeStudentId(
        booking.studentId,
        this.config.getOrThrow<string>('security.anonymitySalt'),
      ),
      subject: booking.subject,
      topic: booking.topic,
      description: booking.description,
      startAt: booking.startAt,
      endAt: booking.endAt,
      durationMinutes: booking.durationMinutes,
      modality: booking.modality,
      status: booking.status,
      rate: money(booking.hourlyRate),
      subtotal: money(booking.subtotal),
      total: money(booking.total),
      isEmergency: booking.isEmergency,
      cancellationReason: booking.cancellationReason,
      createdAt: booking.createdAt,
      // Una solicitud cuya hora ya paso sigue pendiente, pero ya no se puede aceptar.
      canRespond: booking.status === BookingStatus.PENDING && booking.startAt > now,
    };
  }
}
