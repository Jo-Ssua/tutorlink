import { randomUUID } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BookingStatus,
  Modality,
  PaymentStatus,
  Prisma,
  ProposalStatus,
  Role,
  SlotStatus,
  TutoringRequestStatus,
  UserStatus,
  VerificationStatus,
} from '@prisma/client';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { buildPaginationMeta, getPaginationSkip } from '../common/dto/pagination.dto';
import { anonymizeStudentId } from '../common/utils/anonymize';
import { differenceInMinutes, formatDateTime } from '../common/utils/date';
import { calculatePrice, money, roundMoney } from '../common/utils/money';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  BookingListQueryDto,
  CancelBookingDto,
  CreateBookingDto,
  QuoteBookingDto,
  RejectBookingDto,
  SimulatedPaymentDto,
} from './dto/bookings.dto';

const bookingListInclude = {
  subject: true,
  review: true,
  tutor: {
    select: {
      id: true,
      fullName: true,
      tutorProfile: {
        select: {
          id: true,
          averageRating: true,
          reviewCount: true,
          hourlyRate: true,
          modalities: true,
        },
      },
    },
  },
  payments: { orderBy: { createdAt: 'desc' as const }, take: 1 },
} satisfies Prisma.BookingInclude;

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
  ) {}

  async quote(dto: QuoteBookingDto) {
    const { profile, slot } = await this.resolveTutorSlot(dto);
    const durationMinutes = differenceInMinutes(slot.startAt, slot.endAt);
    const price = calculatePrice(
      money(profile.hourlyRate),
      durationMinutes,
      this.config.getOrThrow<number>('platformFeePercent'),
    );

    return {
      tutor: {
        profileId: profile.id,
        userId: profile.userId,
        fullName: profile.user.fullName,
        averageRating: roundMoney(profile.averageRating),
        reviewCount: profile.reviewCount,
        modalities: profile.modalities,
      },
      slot: {
        id: slot.id,
        startAt: slot.startAt,
        endAt: slot.endAt,
        modality: slot.modality,
      },
      price,
      disclaimer:
        'El pago es simulado para el MVP. No se solicitan ni procesan datos bancarios reales.',
    };
  }

  async create(user: AuthenticatedUser, dto: CreateBookingDto) {
    const { profile, slot } = await this.resolveTutorSlot(dto);

    const subject = await this.prisma.subject.findUnique({
      where: { id: dto.subjectId },
    });

    if (!subject) {
      throw new NotFoundException({
        code: 'SUBJECT_NOT_FOUND',
        message: 'La materia no pertenece al pensum oficial',
      });
    }

    const tutorSubject = await this.prisma.tutorSubject.findFirst({
      where: {
        tutorId: profile.id,
        subjectId: dto.subjectId,
        status: VerificationStatus.VERIFIED,
      },
      select: { id: true },
    });

    if (!tutorSubject) {
      throw new BadRequestException({
        code: 'TUTOR_DOES_NOT_TEACH_SUBJECT',
        message: 'El tutor no ofrece la materia seleccionada',
      });
    }

    const durationMinutes = differenceInMinutes(slot.startAt, slot.endAt);
    const price = calculatePrice(
      money(profile.hourlyRate),
      durationMinutes,
      this.config.getOrThrow<number>('platformFeePercent'),
    );

    const booking = await this.prisma.$transaction(async (tx) => {
      const hold = await tx.availabilitySlot.updateMany({
        where: {
          id: slot.id,
          status: SlotStatus.AVAILABLE,
          startAt: { gt: new Date() },
        },
        data: { status: SlotStatus.RESERVED, heldUntil: null },
      });

      if (hold.count === 0) {
        throw new ConflictException({
          code: 'SLOT_NOT_AVAILABLE',
          message: 'La franja seleccionada ya no esta disponible',
        });
      }

      return tx.booking.create({
        data: {
          studentId: user.id,
          tutorId: profile.userId,
          subjectId: dto.subjectId,
          slotId: slot.id,
          topic: dto.topic,
          description: dto.description,
          modality: slot.modality,
          startAt: slot.startAt,
          endAt: slot.endAt,
          status: BookingStatus.PENDING,
          hourlyRate: price.hourlyRate.toFixed(2),
          durationMinutes,
          subtotal: price.subtotal.toFixed(2),
          platformFee: price.platformFee.toFixed(2),
          total: price.total.toFixed(2),
          isEmergency: false,
        },
        include: bookingListInclude,
      });
    });

    await this.notifications.createMany([
      {
        userId: profile.userId,
        type: 'BOOKING_CREATED',
        title: 'Nueva solicitud de tutoria',
        message: `${this.alias(user.id)} solicito una sesion de ${subject.name} para ${formatDateTime(
          booking.startAt,
        )}.`,
        data: {
          bookingId: booking.id,
          subjectId: subject.id,
          topic: booking.topic,
          modality: booking.modality,
          startAt: booking.startAt.toISOString(),
        },
      },
      {
        userId: user.id,
        type: 'BOOKING_CREATED',
        title: 'Solicitud enviada',
        message: `Tu solicitud de ${subject.name} quedo pendiente de respuesta del tutor.`,
        data: { bookingId: booking.id, status: booking.status },
      },
    ]);

    return {
      booking: this.mapBooking(booking, user, 'student'),
      price,
      message: 'Reserva creada en estado pendiente de respuesta del tutor.',
    };
  }

  async listMine(user: AuthenticatedUser, query: BookingListQueryDto) {
    const where: Prisma.BookingWhereInput = {
      studentId: user.id,
      ...(query.status ? { status: query.status } : {}),
      ...(query.from || query.to
        ? {
            startAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        where,
        orderBy: { startAt: 'desc' },
        skip: getPaginationSkip(query.page, query.limit),
        take: query.limit,
        include: bookingListInclude,
      }),
      this.prisma.booking.count({ where }),
    ]);

    return {
      items: items.map((booking) => this.mapBooking(booking, user, 'student')),
      pagination: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async listForTutor(user: AuthenticatedUser, query: BookingListQueryDto) {
    const where: Prisma.BookingWhereInput = {
      tutorId: user.id,
      ...(query.status ? { status: query.status } : {}),
      ...(query.from || query.to
        ? {
            startAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        where,
        orderBy: { startAt: 'desc' },
        skip: getPaginationSkip(query.page, query.limit),
        take: query.limit,
        include: bookingListInclude,
      }),
      this.prisma.booking.count({ where }),
    ]);

    return {
      items: items.map((booking) => this.mapBooking(booking, user, 'tutor')),
      pagination: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async getById(user: AuthenticatedUser, bookingId: string) {
    const booking = await this.findDetailedBooking(bookingId);

    if (
      user.role !== Role.ADMIN &&
      booking.studentId !== user.id &&
      booking.tutorId !== user.id
    ) {
      throw new NotFoundException({
        code: 'BOOKING_NOT_FOUND',
        message: 'La reserva no existe',
      });
    }

    const view = user.role === Role.ADMIN ? 'admin' : user.id === booking.tutorId ? 'tutor' : 'student';
    return this.mapBooking(booking, user, view);
  }

  async accept(user: AuthenticatedUser, bookingId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, tutorId: user.id },
      include: { subject: true },
    });

    if (!booking) {
      throw new NotFoundException({
        code: 'BOOKING_NOT_FOUND',
        message: 'La reserva no existe',
      });
    }

    if (booking.status !== BookingStatus.PENDING) {
      throw new ConflictException({
        code: 'INVALID_BOOKING_STATE',
        message: `No se puede aceptar una reserva en estado ${booking.status}`,
      });
    }

    const updated = await this.prisma.booking.update({
      where: { id: booking.id },
      data: { status: BookingStatus.ACCEPTED },
      include: bookingListInclude,
    });

    await this.notifications.create({
      userId: booking.studentId,
      type: 'BOOKING_STATUS_CHANGED',
      title: 'Solicitud aceptada',
      message: `El tutor acepto tu sesion de ${booking.subject.name}. Confirma el pago simulado para completar la reserva.`,
      data: {
        bookingId: booking.id,
        status: updated.status,
        total: money(updated.total),
        simulated: true,
      },
    });

    return {
      booking: this.mapBooking(updated, user, 'tutor'),
      message: 'Reserva aceptada. El estudiante debe confirmar el pago simulado.',
    };
  }

  async reject(user: AuthenticatedUser, bookingId: string, dto: RejectBookingDto) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, tutorId: user.id },
      include: { subject: true },
    });

    if (!booking) {
      throw new NotFoundException({
        code: 'BOOKING_NOT_FOUND',
        message: 'La reserva no existe',
      });
    }

    if (booking.status !== BookingStatus.PENDING) {
      throw new ConflictException({
        code: 'INVALID_BOOKING_STATE',
        message: `No se puede rechazar una reserva en estado ${booking.status}`,
      });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const rejected = await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: BookingStatus.REJECTED,
          cancellationReason: dto.reason,
        },
        include: bookingListInclude,
      });

      await this.releaseSlot(tx, booking.slotId, booking.id);
      return rejected;
    });

    await this.notifications.create({
      userId: booking.studentId,
      type: 'BOOKING_STATUS_CHANGED',
      title: 'Solicitud rechazada',
      message: `El tutor rechazo tu solicitud de ${booking.subject.name}. Puedes elegir otro horario o tutor.`,
      data: {
        bookingId: booking.id,
        status: updated.status,
        reason: dto.reason ?? null,
      },
    });

    return {
      booking: this.mapBooking(updated, user, 'tutor'),
      message: 'Reserva rechazada y franja liberada.',
    };
  }

  async confirmPayment(
    user: AuthenticatedUser,
    bookingId: string,
    dto: SimulatedPaymentDto,
  ) {
    if (!dto.simulatePayment) {
      throw new BadRequestException({
        code: 'SIMULATED_PAYMENT_REQUIRED',
        message: 'Debes confirmar el pago simulado para completar la reserva',
      });
    }

    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, studentId: user.id },
      include: { subject: true, payments: true },
    });

    if (!booking) {
      throw new NotFoundException({
        code: 'BOOKING_NOT_FOUND',
        message: 'La reserva no existe',
      });
    }

    if (booking.requestId) {
      throw new ConflictException({
        code: 'USE_STUDYMATCH_CONFIRMATION',
        message: 'Esta reserva proviene de StudyMatch. Confirma la propuesta en /studymatch.',
      });
    }

    if (booking.status === BookingStatus.CONFIRMED) {
      throw new ConflictException({
        code: 'PAYMENT_ALREADY_CONFIRMED',
        message: 'La reserva ya tiene un pago simulado aprobado',
      });
    }

    if (booking.status !== BookingStatus.ACCEPTED) {
      throw new ConflictException({
        code: 'BOOKING_NOT_READY_FOR_PAYMENT',
        message: 'El tutor debe aceptar la solicitud antes de confirmar el pago simulado',
      });
    }

    const reference = this.paymentReference();
    const { updated, payment } = await this.prisma.$transaction(async (tx) => {
      const createdPayment = await tx.payment.create({
        data: {
          bookingId: booking.id,
          studentId: booking.studentId,
          tutorId: booking.tutorId,
          amount: booking.total,
          platformFee: booking.platformFee,
          tutorEarnings: booking.subtotal,
          currency: 'COP',
          type: 'SIMULATED',
          status: PaymentStatus.APPROVED,
          reference,
          simulated: true,
          paidAt: new Date(),
        },
      });

      const confirmed = await tx.booking.update({
        where: { id: booking.id },
        data: { status: BookingStatus.CONFIRMED },
        include: bookingListInclude,
      });

      return { updated: confirmed, payment: createdPayment };
    });

    await this.notifications.createMany([
      {
        userId: booking.tutorId,
        type: 'PAYMENT_SIMULATED',
        title: 'Pago simulado aprobado',
        message: `La reserva de ${booking.subject.name} para ${formatDateTime(
          booking.startAt,
        )} quedo confirmada con pago simulado.`,
        data: {
          bookingId: booking.id,
          paymentId: payment.id,
          reference: payment.reference,
          simulated: true,
        },
      },
      {
        userId: booking.studentId,
        type: 'PAYMENT_SIMULATED',
        title: 'Reserva confirmada',
        message: 'Tu pago simulado fue aprobado y la sesion quedo confirmada.',
        data: {
          bookingId: booking.id,
          paymentId: payment.id,
          reference: payment.reference,
          simulated: true,
        },
      },
    ]);

    return {
      booking: this.mapBooking(updated, user, 'student'),
      payment: {
        id: payment.id,
        reference: payment.reference,
        status: payment.status,
        amount: money(payment.amount),
        simulated: payment.simulated,
        paidAt: payment.paidAt,
      },
      disclaimer:
        'Pago simulado aprobado para el MVP. No se realizo ningun cobro ni transferencia bancaria real.',
    };
  }

  async cancel(user: AuthenticatedUser, bookingId: string, dto: CancelBookingDto) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { subject: true, request: true, proposal: true, payments: true },
    });

    if (
      !booking ||
      (user.role !== Role.ADMIN &&
        booking.studentId !== user.id &&
        booking.tutorId !== user.id)
    ) {
      throw new NotFoundException({
        code: 'BOOKING_NOT_FOUND',
        message: 'La reserva no existe',
      });
    }

    if (
      ![BookingStatus.PENDING, BookingStatus.ACCEPTED, BookingStatus.CONFIRMED].some(
        (status) => status === booking.status,
      )
    ) {
      throw new ConflictException({
        code: 'INVALID_BOOKING_STATE',
        message: `No se puede cancelar una reserva en estado ${booking.status}`,
      });
    }

    if (user.role === Role.STUDENT) {
      const windowHours = this.config.getOrThrow<number>('cancellationWindowHours');
      const hoursUntilStart = (booking.startAt.getTime() - Date.now()) / 3_600_000;

      if (hoursUntilStart < windowHours) {
        throw new ConflictException({
          code: 'CANCELLATION_WINDOW_CLOSED',
          message: `Solo puedes cancelar con al menos ${windowHours} horas de anticipacion`,
        });
      }
    }

    if (user.role === Role.TUTOR && booking.tutorId === user.id && !dto.reason) {
      throw new BadRequestException({
        code: 'CANCELLATION_REASON_REQUIRED',
        message: 'El tutor debe registrar un motivo de cancelacion',
      });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (booking.payments.some((payment) => payment.status === PaymentStatus.APPROVED)) {
        await tx.payment.updateMany({
          where: { bookingId: booking.id, status: PaymentStatus.APPROVED },
          data: { status: PaymentStatus.REFUNDED, refundedAt: new Date() },
        });
      }

      const cancelled = await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: BookingStatus.CANCELLED,
          cancellationReason: dto.reason,
          cancelledAt: new Date(),
        },
        include: bookingListInclude,
      });

      if (booking.requestId) {
        await tx.tutoringRequest.updateMany({
          where: { id: booking.requestId },
          data: { status: TutoringRequestStatus.CANCELLED, cancelledAt: new Date() },
        });
      }

      if (booking.proposalId) {
        await tx.studyMatchProposal.updateMany({
          where: { id: booking.proposalId },
          data: { status: ProposalStatus.CANCELLED },
        });
      }

      await this.releaseSlot(tx, booking.slotId, booking.id);
      return cancelled;
    });

    const cancelledByStudent = user.id === booking.studentId;
    const recipientId = cancelledByStudent ? booking.tutorId : booking.studentId;

    await this.notifications.create({
      userId: recipientId,
      type: 'BOOKING_STATUS_CHANGED',
      title: 'Reserva cancelada',
      message: `La sesion de ${booking.subject.name} para ${formatDateTime(
        booking.startAt,
      )} fue cancelada${dto.reason ? `: ${dto.reason}` : '.'}`,
      data: {
        bookingId: booking.id,
        status: updated.status,
        reason: dto.reason ?? null,
        simulatedRefund: booking.payments.some(
          (payment) => payment.status === PaymentStatus.APPROVED,
        ),
      },
    });

    return {
      booking: this.mapBooking(
        updated,
        user,
        user.role === Role.ADMIN ? 'admin' : cancelledByStudent ? 'student' : 'tutor',
      ),
      message: 'Reserva cancelada. Si existia un pago simulado aprobado, fue marcado como reembolsado.',
    };
  }

  async complete(user: AuthenticatedUser, bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { subject: true },
    });

    if (!booking || (user.role !== Role.ADMIN && booking.tutorId !== user.id)) {
      throw new NotFoundException({
        code: 'BOOKING_NOT_FOUND',
        message: 'La reserva no existe',
      });
    }

    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new ConflictException({
        code: 'INVALID_BOOKING_STATE',
        message: `Solo una reserva confirmada puede completarse. Estado actual: ${booking.status}`,
      });
    }

    if (user.role === Role.TUTOR && new Date() < booking.startAt) {
      throw new BadRequestException({
        code: 'SESSION_NOT_STARTED',
        message: 'La sesion aun no ha iniciado',
      });
    }

    const updated = await this.prisma.booking.update({
      where: { id: booking.id },
      data: { status: BookingStatus.COMPLETED, completedAt: new Date() },
      include: bookingListInclude,
    });

    await this.notifications.create({
      userId: booking.studentId,
      type: 'BOOKING_STATUS_CHANGED',
      title: 'Sesion completada',
      message: `Tu sesion de ${booking.subject.name} fue completada. Ya puedes calificar al tutor.`,
      data: { bookingId: booking.id, status: updated.status },
    });

    return {
      booking: this.mapBooking(updated, user, user.role === Role.ADMIN ? 'admin' : 'tutor'),
      message: 'Sesion completada. El estudiante ya puede dejar una resena.',
    };
  }

  private async resolveTutorSlot(dto: QuoteBookingDto) {
    const profile = await this.prisma.tutorProfile.findFirst({
      where: {
        id: dto.tutorProfileId,
        verificationStatus: VerificationStatus.VERIFIED,
        isActive: true,
        user: { status: UserStatus.ACTIVE },
      },
      include: { user: { select: { fullName: true } } },
    });

    if (!profile) {
      throw new NotFoundException({
        code: 'TUTOR_NOT_AVAILABLE',
        message: 'El tutor no existe o no esta disponible',
      });
    }

    const slot = await this.prisma.availabilitySlot.findFirst({
      where: {
        id: dto.slotId,
        tutorId: profile.id,
        status: SlotStatus.AVAILABLE,
        startAt: { gt: new Date() },
      },
    });

    if (!slot) {
      throw new ConflictException({
        code: 'SLOT_NOT_AVAILABLE',
        message: 'La franja seleccionada ya no esta disponible',
      });
    }

    return { profile, slot };
  }

  private async findDetailedBooking(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        subject: true,
        review: true,
        payments: { orderBy: { createdAt: 'desc' } },
        student: { select: { id: true, fullName: true, email: true } },
        tutor: {
          select: {
            id: true,
            fullName: true,
            email: true,
            tutorProfile: {
              select: {
                id: true,
                averageRating: true,
                reviewCount: true,
                hourlyRate: true,
                modalities: true,
              },
            },
          },
        },
        request: { select: { id: true, status: true, urgency: true } },
        proposal: { select: { id: true, status: true, score: true } },
      },
    });

    if (!booking) {
      throw new NotFoundException({
        code: 'BOOKING_NOT_FOUND',
        message: 'La reserva no existe',
      });
    }

    return booking;
  }

  private mapBooking(
    booking: {
      id: string;
      studentId: string;
      tutorId: string;
      topic: string;
      description: string | null;
      modality: Modality;
      startAt: Date;
      endAt: Date;
      status: BookingStatus;
      hourlyRate: Prisma.Decimal;
      durationMinutes: number;
      subtotal: Prisma.Decimal;
      platformFee: Prisma.Decimal;
      total: Prisma.Decimal;
      isEmergency: boolean;
      requestId: string | null;
      proposalId: string | null;
      cancellationReason: string | null;
      cancelledAt: Date | null;
      completedAt: Date | null;
      createdAt: Date;
      subject: { id: string; name: string; code: string };
      review?: {
        rating: number;
        comment: string | null;
        createdAt: Date;
        isAnonymous: boolean;
      } | null;
      payments?: Array<{
        id: string;
        reference: string;
        status: PaymentStatus;
        amount: Prisma.Decimal;
        simulated: boolean;
        paidAt: Date | null;
      }>;
      tutor?: {
        id: string;
        fullName: string;
        tutorProfile?: {
          id: string;
          averageRating: number;
          reviewCount: number;
        } | null;
      };
      student?: { id: string; fullName: string; email: string };
      request?: { id: string; status: TutoringRequestStatus; urgency: string } | null;
      proposal?: { id: string; status: ProposalStatus; score: number } | null;
    },
    viewer: AuthenticatedUser,
    view: 'student' | 'tutor' | 'admin',
  ) {
    const latestPayment = booking.payments?.[0] ?? null;
    const tutorProfile = booking.tutor?.tutorProfile ?? null;

    return {
      id: booking.id,
      status: booking.status,
      topic: booking.topic,
      description: booking.description,
      modality: booking.modality,
      startAt: booking.startAt,
      endAt: booking.endAt,
      durationMinutes: booking.durationMinutes,
      isEmergency: booking.isEmergency,
      requestId: booking.requestId,
      proposalId: booking.proposalId,
      subject: booking.subject,
      tutor: booking.tutor
        ? {
            id: booking.tutor.id,
            fullName: booking.tutor.fullName,
            profileId: tutorProfile?.id ?? null,
            averageRating: tutorProfile ? roundMoney(tutorProfile.averageRating) : null,
            reviewCount: tutorProfile?.reviewCount ?? null,
          }
        : null,
      student:
        view === 'tutor'
          ? { alias: this.alias(booking.studentId) }
          : view === 'admin'
            ? {
                id: booking.student?.id ?? booking.studentId,
                fullName: booking.student?.fullName ?? null,
                email: booking.student?.email ?? null,
              }
            : { id: viewer.id },
      price: {
        hourlyRate: money(booking.hourlyRate),
        subtotal: money(booking.subtotal),
        platformFee: money(booking.platformFee),
        total: money(booking.total),
        currency: 'COP',
        simulated: true,
      },
      review: booking.review
        ? {
            rating: booking.review.rating,
            comment: booking.review.comment,
            createdAt: booking.review.createdAt,
            isAnonymous: booking.review.isAnonymous,
          }
        : null,
      payment: latestPayment
        ? {
            id: latestPayment.id,
            reference: latestPayment.reference,
            status: latestPayment.status,
            amount: money(latestPayment.amount),
            simulated: latestPayment.simulated,
            paidAt: latestPayment.paidAt,
          }
        : null,
      cancellationReason: booking.cancellationReason,
      cancelledAt: booking.cancelledAt,
      completedAt: booking.completedAt,
      createdAt: booking.createdAt,
    };
  }

  private async releaseSlot(
    tx: Prisma.TransactionClient,
    slotId: string,
    excludeBookingId: string,
  ) {
    const activeBookings = await tx.booking.count({
      where: {
        slotId,
        id: { not: excludeBookingId },
        status: {
          in: [BookingStatus.PENDING, BookingStatus.ACCEPTED, BookingStatus.CONFIRMED],
        },
      },
    });
    const activeProposals = await tx.studyMatchProposal.count({
      where: {
        slotId,
        status: { in: [ProposalStatus.PENDING_TUTOR, ProposalStatus.TUTOR_ACCEPTED] },
      },
    });

    if (activeBookings === 0 && activeProposals === 0) {
      await tx.availabilitySlot.updateMany({
        where: { id: slotId, status: { in: [SlotStatus.RESERVED, SlotStatus.HELD] } },
        data: { status: SlotStatus.AVAILABLE, heldUntil: null },
      });
    }
  }

  private paymentReference(): string {
    return `SIM-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;
  }

  private alias(studentId: string): string {
    return anonymizeStudentId(
      studentId,
      this.config.getOrThrow<string>('security.anonymitySalt'),
    );
  }
}
