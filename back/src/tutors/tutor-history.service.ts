import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingStatus, Prisma } from '@prisma/client';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { buildPaginationMeta, getPaginationSkip } from '../common/dto/pagination.dto';
import { anonymizeStudentId } from '../common/utils/anonymize';
import { money, roundMoney } from '../common/utils/money';
import { PrismaService } from '../prisma/prisma.service';
import { TutorHistoryQueryDto } from './dto/tutors.dto';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Historial de tutorias y calificaciones del tutor (SCRUM-29/32).
 *
 * Es de solo lectura: filtrar, paginar o abrir un detalle nunca modifica reservas, pagos ni
 * resenas. El estudiante siempre se devuelve como alias anonimo.
 */
@Injectable()
export class TutorHistoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async list(user: AuthenticatedUser, query: TutorHistoryQueryDto) {
    const where = this.buildWhere(user.id, query);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        where,
        orderBy: { startAt: 'desc' },
        skip: getPaginationSkip(query.page, query.limit),
        take: query.limit,
        include: { subject: true, review: true },
      }),
      this.prisma.booking.count({ where }),
    ]);

    return {
      items: items.map((booking) => this.mapItem(booking)),
      pagination: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async detail(user: AuthenticatedUser, bookingId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, tutorId: user.id },
      include: {
        subject: true,
        review: true,
        payments: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    if (!booking) {
      throw new NotFoundException({
        code: 'BOOKING_NOT_FOUND',
        message: 'La sesion no existe en tu historial',
      });
    }

    const payment = booking.payments[0] ?? null;

    return {
      ...this.mapItem(booking),
      description: booking.description,
      platformFee: money(booking.platformFee),
      tutorEarnings: money(booking.subtotal),
      cancellationReason: booking.cancellationReason,
      cancelledAt: booking.cancelledAt,
      completedAt: booking.completedAt,
      createdAt: booking.createdAt,
      payment: payment
        ? {
            status: payment.status,
            reference: payment.reference,
            paidAt: payment.paidAt,
            simulated: payment.simulated,
          }
        : null,
    };
  }

  /** Resumen de trayectoria: no depende de los filtros del listado. */
  async summary(user: AuthenticatedUser) {
    const [byStatus, ratingGroups, ratingTotals, subjectRows, firstSession] = await Promise.all([
      this.prisma.booking.groupBy({
        by: ['status'],
        where: { tutorId: user.id },
        _count: { _all: true },
      }),
      this.prisma.review.groupBy({
        by: ['rating'],
        where: { tutorId: user.id },
        _count: { _all: true },
      }),
      this.prisma.review.aggregate({
        where: { tutorId: user.id },
        _avg: { rating: true },
        _count: { _all: true },
      }),
      this.prisma.booking.findMany({
        where: { tutorId: user.id },
        distinct: ['subjectId'],
        select: { subject: { select: { id: true, code: true, name: true } } },
        orderBy: { subjectId: 'asc' },
      }),
      this.prisma.booking.findFirst({
        where: { tutorId: user.id },
        orderBy: { startAt: 'asc' },
        select: { startAt: true },
      }),
    ]);

    const sessionsByStatus = Object.fromEntries(
      Object.values(BookingStatus).map((status) => [status, 0]),
    ) as Record<BookingStatus, number>;
    for (const group of byStatus) {
      sessionsByStatus[group.status] = group._count._all;
    }

    const ratingDistribution: Record<'1' | '2' | '3' | '4' | '5', number> = {
      '1': 0,
      '2': 0,
      '3': 0,
      '4': 0,
      '5': 0,
    };
    for (const group of ratingGroups) {
      const key = String(group.rating) as keyof typeof ratingDistribution;
      if (key in ratingDistribution) {
        ratingDistribution[key] = group._count._all;
      }
    }

    return {
      totalSessions: Object.values(sessionsByStatus).reduce((sum, count) => sum + count, 0),
      sessionsByStatus,
      completedSessions: sessionsByStatus.COMPLETED,
      reviewCount: ratingTotals._count._all,
      averageRating: ratingTotals._avg.rating ? roundMoney(ratingTotals._avg.rating) : 0,
      ratingDistribution,
      firstSessionAt: firstSession?.startAt ?? null,
      subjects: subjectRows.map((row) => row.subject),
    };
  }

  private buildWhere(tutorUserId: string, query: TutorHistoryQueryDto): Prisma.BookingWhereInput {
    const from = query.from ? new Date(query.from) : undefined;
    let to = query.to ? new Date(query.to) : undefined;

    // `to=2026-11-10` debe incluir todo el dia 10, no solo su medianoche.
    if (to && query.to && DATE_ONLY.test(query.to)) {
      to = new Date(to.getTime() + 24 * 3_600_000 - 1);
    }

    if (from && to && from > to) {
      throw new BadRequestException({
        code: 'INVALID_DATE_RANGE',
        message: 'La fecha inicial no puede ser posterior a la fecha final',
      });
    }

    return {
      tutorId: tutorUserId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.subjectId ? { subjectId: query.subjectId } : {}),
      ...(from || to
        ? { startAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
        : {}),
    };
  }

  private mapItem(booking: {
    id: string;
    studentId: string;
    topic: string;
    startAt: Date;
    endAt: Date;
    durationMinutes: number;
    modality: string;
    status: BookingStatus;
    hourlyRate: Prisma.Decimal;
    subtotal: Prisma.Decimal;
    total: Prisma.Decimal;
    isEmergency: boolean;
    subject: { id: string; code: string; name: string };
    review: {
      rating: number;
      comment: string | null;
      isAnonymous: boolean;
      createdAt: Date;
    } | null;
  }) {
    return {
      id: booking.id,
      studentAlias: anonymizeStudentId(
        booking.studentId,
        this.config.getOrThrow<string>('security.anonymitySalt'),
      ),
      subject: { id: booking.subject.id, code: booking.subject.code, name: booking.subject.name },
      topic: booking.topic,
      startAt: booking.startAt,
      endAt: booking.endAt,
      durationMinutes: booking.durationMinutes,
      modality: booking.modality,
      status: booking.status,
      rate: money(booking.hourlyRate),
      subtotal: money(booking.subtotal),
      total: money(booking.total),
      isEmergency: booking.isEmergency,
      review: booking.review
        ? {
            rating: booking.review.rating,
            comment: booking.review.comment,
            isAnonymous: booking.review.isAnonymous,
            createdAt: booking.review.createdAt,
          }
        : null,
    };
  }
}
