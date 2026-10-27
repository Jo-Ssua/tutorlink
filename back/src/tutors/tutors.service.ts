import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BookingStatus,
  Modality,
  Prisma,
  ProposalStatus,
  Role,
  SlotStatus,
  UserStatus,
  VerificationStatus,
} from '@prisma/client';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { buildPaginationMeta, getPaginationSkip } from '../common/dto/pagination.dto';
import { anonymizeStudentId } from '../common/utils/anonymize';
import {
  addDays,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from '../common/utils/date';
import { money, roundMoney } from '../common/utils/money';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  AddTutorSubjectDto,
  ApplyTutorDto,
  AvailabilityQueryDto,
  CreateAvailabilityDto,
  EarningsGroupBy,
  EarningsQueryDto,
  TutorHistoryQueryDto,
  TutorRequestsQueryDto,
  TutorSearchQueryDto,
  TutorSortBy,
  UpdateAvailabilityDto,
  UpdateTutorProfileDto,
} from './dto/tutors.dto';

interface TutorCardData {
  id: string;
  userId: string;
  bio: string | null;
  experienceYears: number;
  hourlyRate: Prisma.Decimal;
  averageRating: number;
  reviewCount: number;
  modalities: Modality[];
  isActive: boolean;
  user: { fullName: string };
  subjects: Array<{ subject: { id: string; code: string; name: string } }>;
  professors: Array<{ professor: { id: string; fullName: string } }>;
  availability: Array<{ startAt: Date }>;
}

@Injectable()
export class TutorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
  ) {}

  async apply(user: AuthenticatedUser, dto: ApplyTutorDto) {
    if (user.role === Role.ADMIN) {
      throw new ForbiddenException({
        code: 'ADMIN_CANNOT_APPLY',
        message: 'Un administrador no puede postularse como tutor',
      });
    }

    const existing = await this.prisma.tutorProfile.findUnique({
      where: { userId: user.id },
    });

    if (existing?.verificationStatus === VerificationStatus.VERIFIED) {
      throw new ConflictException({
        code: 'TUTOR_ALREADY_VERIFIED',
        message: 'El perfil de tutor ya se encuentra verificado',
      });
    }

    const subjectIds = [...new Set(dto.subjects.map((subject) => subject.subjectId))];
    const subjects = await this.prisma.subject.findMany({
      where: { id: { in: subjectIds } },
      select: { id: true },
    });

    if (subjects.length !== subjectIds.length) {
      throw new NotFoundException({
        code: 'SUBJECT_NOT_FOUND',
        message: 'Una o mas materias no pertenecen al pensum oficial',
      });
    }

    const professorIds = [...new Set(dto.professorIds ?? [])];
    if (professorIds.length > 0) {
      const professors = await this.prisma.professor.findMany({
        where: { id: { in: professorIds } },
        include: { subjectLinks: { select: { subjectId: true } } },
      });

      if (professors.length !== professorIds.length) {
        throw new NotFoundException({
          code: 'PROFESSOR_NOT_FOUND',
          message: 'Uno o mas profesores indicados no existen',
        });
      }

      const mismatch = professors.find(
        (professor) =>
          !professor.subjectLinks.some((link) => subjectIds.includes(link.subjectId)),
      );

      if (mismatch) {
        throw new BadRequestException({
          code: 'PROFESSOR_SUBJECT_MISMATCH',
          message: `El profesor ${mismatch.fullName} no dicta ninguna de las materias seleccionadas`,
        });
      }
    }

    const profile = await this.prisma.$transaction(async (tx) => {
      const tutorProfile = await tx.tutorProfile.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          bio: dto.bio,
          experienceYears: dto.experienceYears,
          hourlyRate: dto.hourlyRate.toFixed(2),
          modalities: dto.modalities,
          verificationStatus: VerificationStatus.PENDING,
        },
        update: {
          bio: dto.bio,
          experienceYears: dto.experienceYears,
          hourlyRate: dto.hourlyRate.toFixed(2),
          modalities: dto.modalities,
          verificationStatus: VerificationStatus.PENDING,
          rejectionReason: null,
          verifiedAt: null,
        },
      });

      await tx.tutorSubject.deleteMany({ where: { tutorId: tutorProfile.id } });
      await tx.tutorSubject.createMany({
        data: dto.subjects.map((subject) => ({
          tutorId: tutorProfile.id,
          subjectId: subject.subjectId,
          evidenceUrl: subject.evidenceUrl,
          status: VerificationStatus.PENDING,
        })),
      });

      await tx.tutorProfessor.deleteMany({ where: { tutorId: tutorProfile.id } });
      if (professorIds.length > 0) {
        await tx.tutorProfessor.createMany({
          data: professorIds.map((professorId) => ({
            tutorId: tutorProfile.id,
            professorId,
          })),
        });
      }

      return tx.tutorProfile.findUniqueOrThrow({
        where: { id: tutorProfile.id },
        include: {
          user: true,
          subjects: { include: { subject: true } },
          professors: { include: { professor: true } },
          availability: {
            where: { status: SlotStatus.AVAILABLE, startAt: { gt: new Date() } },
            orderBy: { startAt: 'asc' },
            take: 10,
          },
        },
      });
    });

    const admins = await this.prisma.user.findMany({
      where: { role: Role.ADMIN, status: UserStatus.ACTIVE },
      select: { id: true },
    });

    await this.notifications.createMany([
      ...admins.map((admin) => ({
        userId: admin.id,
        type: 'TUTOR_APPLICATION_SUBMITTED' as const,
        title: 'Nueva postulacion de tutor',
        message: `${user.fullName} envio una postulacion con ${dto.subjects.length} materia(s).`,
        data: { tutorProfileId: profile.id, userId: user.id },
      })),
      {
        userId: user.id,
        type: 'TUTOR_APPLICATION_SUBMITTED' as const,
        title: 'Postulacion enviada',
        message: 'Tu postulacion fue recibida. Un administrador revisara la evidencia academica.',
        data: { tutorProfileId: profile.id },
      },
    ]);

    return this.mapOwnProfile(profile);
  }

  async getOwnProfile(user: AuthenticatedUser) {
    const profile = await this.prisma.tutorProfile.findUnique({
      where: { userId: user.id },
      include: {
        user: true,
        subjects: { include: { subject: true } },
        professors: { include: { professor: true } },
        availability: {
          where: { status: SlotStatus.AVAILABLE, startAt: { gt: new Date() } },
          orderBy: { startAt: 'asc' },
          take: 10,
        },
      },
    });

    if (!profile) {
      throw new NotFoundException({
        code: 'TUTOR_PROFILE_NOT_FOUND',
        message: 'No tienes un perfil de tutor. Envia una postulacion primero.',
      });
    }

    return this.mapOwnProfile(profile);
  }

  async updateProfile(user: AuthenticatedUser, dto: UpdateTutorProfileDto) {
    const profile = await this.requireVerifiedProfile(user.id);

    await this.prisma.tutorProfile.update({
      where: { id: profile.id },
      data: {
        ...(dto.bio !== undefined ? { bio: dto.bio } : {}),
        ...(dto.experienceYears !== undefined
          ? { experienceYears: dto.experienceYears }
          : {}),
        ...(dto.hourlyRate !== undefined
          ? { hourlyRate: dto.hourlyRate.toFixed(2) }
          : {}),
        ...(dto.modalities !== undefined ? { modalities: dto.modalities } : {}),
        ...(dto.maxWeeklySessions !== undefined
          ? { maxWeeklySessions: dto.maxWeeklySessions }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });

    return this.getOwnProfile(user);
  }

  async addSubject(user: AuthenticatedUser, dto: AddTutorSubjectDto) {
    const profile = await this.requireVerifiedProfile(user.id);
    const subject = await this.prisma.subject.findUnique({
      where: { id: dto.subjectId },
    });

    if (!subject) {
      throw new NotFoundException({
        code: 'SUBJECT_NOT_FOUND',
        message: 'La materia no pertenece al pensum oficial',
      });
    }

    const existing = await this.prisma.tutorSubject.findUnique({
      where: { tutorId_subjectId: { tutorId: profile.id, subjectId: dto.subjectId } },
    });

    if (existing?.status === VerificationStatus.VERIFIED) {
      throw new ConflictException({
        code: 'SUBJECT_ALREADY_VERIFIED',
        message: 'La materia ya se encuentra verificada en tu perfil',
      });
    }

    const link = await this.prisma.tutorSubject.upsert({
      where: { tutorId_subjectId: { tutorId: profile.id, subjectId: dto.subjectId } },
      create: {
        tutorId: profile.id,
        subjectId: dto.subjectId,
        evidenceUrl: dto.evidenceUrl,
        status: VerificationStatus.PENDING,
      },
      update: {
        evidenceUrl: dto.evidenceUrl,
        status: VerificationStatus.PENDING,
        rejectionReason: null,
        verifiedAt: null,
      },
      include: { subject: true },
    });

    const admins = await this.prisma.user.findMany({
      where: { role: Role.ADMIN, status: UserStatus.ACTIVE },
      select: { id: true },
    });

    await this.notifications.createMany(
      admins.map((admin) => ({
        userId: admin.id,
        type: 'TUTOR_APPLICATION_SUBMITTED' as const,
        title: 'Materia pendiente de validacion',
        message: `${user.fullName} agrego ${subject.name} y requiere validacion.`,
        data: { tutorProfileId: profile.id, tutorSubjectId: link.id },
      })),
    );

    return link;
  }

  async removeSubject(user: AuthenticatedUser, tutorSubjectId: string) {
    const profile = await this.requireVerifiedProfile(user.id);
    const link = await this.prisma.tutorSubject.findFirst({
      where: { id: tutorSubjectId, tutorId: profile.id },
      include: { subject: true },
    });

    if (!link) {
      throw new NotFoundException({
        code: 'TUTOR_SUBJECT_NOT_FOUND',
        message: 'La materia no esta asociada a tu perfil',
      });
    }

    const futureBookings = await this.prisma.booking.count({
      where: {
        tutorId: user.id,
        subjectId: link.subjectId,
        status: { in: [BookingStatus.PENDING, BookingStatus.ACCEPTED, BookingStatus.CONFIRMED] },
        startAt: { gt: new Date() },
      },
    });

    if (futureBookings > 0) {
      throw new ConflictException({
        code: 'SUBJECT_HAS_ACTIVE_BOOKINGS',
        message: 'No puedes retirar una materia con reservas activas o futuras',
      });
    }

    await this.prisma.tutorSubject.delete({ where: { id: link.id } });
    return { removed: true, subject: link.subject };
  }

  async listAvailability(user: AuthenticatedUser, query: AvailabilityQueryDto) {
    const profile = await this.requireTutorProfile(user.id);
    const slots = await this.prisma.availabilitySlot.findMany({
      where: {
        tutorId: profile.id,
        ...(query.modality ? { modality: query.modality } : {}),
        ...(query.from || query.to
          ? {
              startAt: {
                ...(query.from ? { gte: new Date(query.from) } : {}),
                ...(query.to ? { lte: new Date(query.to) } : {}),
              },
            }
          : {}),
      },
      orderBy: { startAt: 'asc' },
    });

    return slots.map((slot) => this.mapSlot(slot));
  }

  async publicAvailability(tutorProfileId: string, query: AvailabilityQueryDto) {
    const profile = await this.prisma.tutorProfile.findFirst({
      where: {
        id: tutorProfileId,
        verificationStatus: VerificationStatus.VERIFIED,
        isActive: true,
        user: { status: UserStatus.ACTIVE },
      },
      select: { id: true },
    });

    if (!profile) {
      throw new NotFoundException({
        code: 'TUTOR_NOT_FOUND',
        message: 'El tutor no existe o no esta disponible',
      });
    }

    const now = new Date();
    const slots = await this.prisma.availabilitySlot.findMany({
      where: {
        tutorId: profile.id,
        status: SlotStatus.AVAILABLE,
        startAt: {
          gt: now,
          ...(query.from ? { gte: new Date(query.from) } : {}),
          ...(query.to ? { lte: new Date(query.to) } : {}),
        },
        ...(query.modality ? { modality: query.modality } : {}),
      },
      orderBy: { startAt: 'asc' },
      take: 100,
    });

    return slots.map((slot) => this.mapSlot(slot));
  }

  async createAvailability(user: AuthenticatedUser, dto: CreateAvailabilityDto) {
    const profile = await this.requireVerifiedProfile(user.id);
    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);
    this.validateSlotRange(startAt, endAt);

    const overlap = await this.prisma.availabilitySlot.findFirst({
      where: {
        tutorId: profile.id,
        startAt: { lt: endAt },
        endAt: { gt: startAt },
      },
      select: { id: true },
    });

    if (overlap) {
      throw new ConflictException({
        code: 'AVAILABILITY_OVERLAP',
        message: 'La franja se cruza con otra franja existente',
      });
    }

    const slot = await this.prisma.availabilitySlot.create({
      data: {
        tutorId: profile.id,
        startAt,
        endAt,
        modality: dto.modality,
        status: SlotStatus.AVAILABLE,
      },
    });

    return this.mapSlot(slot);
  }

  async updateAvailability(
    user: AuthenticatedUser,
    slotId: string,
    dto: UpdateAvailabilityDto,
  ) {
    const slot = await this.requireOwnedSlot(user.id, slotId);
    await this.assertSlotHasNoHistory(slot.id);

    const startAt = dto.startAt ? new Date(dto.startAt) : slot.startAt;
    const endAt = dto.endAt ? new Date(dto.endAt) : slot.endAt;
    this.validateSlotRange(startAt, endAt);

    const overlap = await this.prisma.availabilitySlot.findFirst({
      where: {
        tutorId: slot.tutorId,
        id: { not: slot.id },
        startAt: { lt: endAt },
        endAt: { gt: startAt },
      },
      select: { id: true },
    });

    if (overlap) {
      throw new ConflictException({
        code: 'AVAILABILITY_OVERLAP',
        message: 'La franja se cruza con otra franja existente',
      });
    }

    const updated = await this.prisma.availabilitySlot.update({
      where: { id: slot.id },
      data: {
        startAt,
        endAt,
        ...(dto.modality ? { modality: dto.modality } : {}),
        status: SlotStatus.AVAILABLE,
        heldUntil: null,
      },
    });

    return this.mapSlot(updated);
  }

  async deleteAvailability(user: AuthenticatedUser, slotId: string) {
    const slot = await this.requireOwnedSlot(user.id, slotId);
    const [bookingCount, proposalCount] = await this.prisma.$transaction([
      this.prisma.booking.count({ where: { slotId: slot.id } }),
      this.prisma.studyMatchProposal.count({ where: { slotId: slot.id } }),
    ]);

    if (slot.status === SlotStatus.RESERVED || slot.status === SlotStatus.HELD) {
      throw new ConflictException({
        code: 'SLOT_HAS_ACTIVE_BOOKING',
        message: 'La franja tiene una reserva o propuesta activa. Gestiona la reserva primero.',
      });
    }

    if (bookingCount > 0 || proposalCount > 0) {
      await this.prisma.availabilitySlot.update({
        where: { id: slot.id },
        data: { status: SlotStatus.BLOCKED, heldUntil: null },
      });

      return {
        deleted: false,
        blocked: true,
        message:
          'La franja tiene historial asociado y fue bloqueada para preservar los registros historicos.',
      };
    }

    await this.prisma.availabilitySlot.delete({ where: { id: slot.id } });
    return { deleted: true, blocked: false };
  }

  async dashboard(user: AuthenticatedUser) {
    const profile = await this.requireTutorProfile(user.id);
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = addDays(todayStart, 1);

    const [
      pendingRequests,
      acceptedRequests,
      confirmedSessions,
      rejectedRequests,
      completedSessions,
      cancelledSessions,
      upcomingSessions,
      pendingProposals,
      pendingProposalsCount,
      unreadNotifications,
      todaySessions,
      availabilityNext7Days,
    ] = await Promise.all([
      this.prisma.booking.count({
        where: { tutorId: user.id, status: BookingStatus.PENDING },
      }),
      this.prisma.booking.count({
        where: { tutorId: user.id, status: BookingStatus.ACCEPTED },
      }),
      this.prisma.booking.count({
        where: { tutorId: user.id, status: BookingStatus.CONFIRMED },
      }),
      this.prisma.booking.count({
        where: { tutorId: user.id, status: BookingStatus.REJECTED },
      }),
      this.prisma.booking.count({
        where: { tutorId: user.id, status: BookingStatus.COMPLETED },
      }),
      this.prisma.booking.count({
        where: { tutorId: user.id, status: BookingStatus.CANCELLED },
      }),
      this.prisma.booking.findMany({
        where: {
          tutorId: user.id,
          status: BookingStatus.CONFIRMED,
          startAt: { gte: now },
        },
        orderBy: { startAt: 'asc' },
        take: 5,
        include: { subject: true },
      }),
      this.prisma.studyMatchProposal.findMany({
        where: {
          tutorId: user.id,
          status: ProposalStatus.PENDING_TUTOR,
          expiresAt: { gt: now },
        },
        orderBy: { expiresAt: 'asc' },
        take: 5,
        include: {
          request: { include: { subject: true, professor: true } },
          slot: true,
        },
      }),
      this.prisma.studyMatchProposal.count({
        where: {
          tutorId: user.id,
          status: ProposalStatus.PENDING_TUTOR,
          expiresAt: { gt: now },
        },
      }),
      this.prisma.notification.count({
        where: { userId: user.id, readAt: null },
      }),
      this.prisma.booking.count({
        where: {
          tutorId: user.id,
          status: BookingStatus.CONFIRMED,
          startAt: { gte: todayStart, lt: todayEnd },
        },
      }),
      this.prisma.availabilitySlot.count({
        where: {
          tutorId: profile.id,
          status: SlotStatus.AVAILABLE,
          startAt: { gte: now, lte: addDays(now, 7) },
        },
      }),
    ]);

    return {
      profile: {
        id: profile.id,
        verificationStatus: profile.verificationStatus,
        isActive: profile.isActive,
        averageRating: roundMoney(profile.averageRating),
        reviewCount: profile.reviewCount,
        hourlyRate: money(profile.hourlyRate),
        modalities: profile.modalities,
      },
      stats: {
        pendingRequests,
        acceptedRequests,
        confirmedSessions,
        rejectedRequests,
        completedSessions,
        cancelledSessions,
        todaySessions,
        unreadNotifications,
        availabilityNext7Days,
        pendingStudyMatchProposals: pendingProposalsCount,
      },
      upcomingSessions: upcomingSessions.map((booking) => ({
        id: booking.id,
        studentAlias: this.alias(booking.studentId),
        subject: booking.subject,
        topic: booking.topic,
        startAt: booking.startAt,
        endAt: booking.endAt,
        modality: booking.modality,
        status: booking.status,
        rate: money(booking.hourlyRate),
        total: money(booking.total),
        isEmergency: booking.isEmergency,
      })),
      pendingStudyMatchProposals: pendingProposals.map((proposal) => ({
        id: proposal.id,
        requestId: proposal.requestId,
        studentAlias: this.alias(proposal.request.studentId),
        subject: proposal.request.subject,
        professor: proposal.request.professor,
        topic: proposal.request.topic,
        urgency: proposal.request.urgency,
        modality: proposal.request.modality,
        startAt: proposal.slot.startAt,
        endAt: proposal.slot.endAt,
        expiresAt: proposal.expiresAt,
        score: roundMoney(proposal.score),
      })),
    };
  }

  async requests(user: AuthenticatedUser, query: TutorRequestsQueryDto) {
    const where: Prisma.BookingWhereInput = {
      tutorId: user.id,
      ...(query.status ? { status: query.status } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: getPaginationSkip(query.page, query.limit),
        take: query.limit,
        include: { subject: true },
      }),
      this.prisma.booking.count({ where }),
    ]);

    return {
      items: items.map((booking) => ({
        id: booking.id,
        studentAlias: this.alias(booking.studentId),
        subject: booking.subject,
        topic: booking.topic,
        description: booking.description,
        startAt: booking.startAt,
        endAt: booking.endAt,
        modality: booking.modality,
        status: booking.status,
        rate: money(booking.hourlyRate),
        total: money(booking.total),
        isEmergency: booking.isEmergency,
        createdAt: booking.createdAt,
      })),
      pagination: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async history(user: AuthenticatedUser, query: TutorHistoryQueryDto) {
    const where: Prisma.BookingWhereInput = {
      tutorId: user.id,
      ...(query.status ? { status: query.status } : {}),
      ...(query.subjectId ? { subjectId: query.subjectId } : {}),
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
        include: { subject: true, review: true },
      }),
      this.prisma.booking.count({ where }),
    ]);

    return {
      items: items.map((booking) => ({
        id: booking.id,
        studentAlias: this.alias(booking.studentId),
        subject: booking.subject,
        topic: booking.topic,
        startAt: booking.startAt,
        endAt: booking.endAt,
        modality: booking.modality,
        status: booking.status,
        rate: money(booking.hourlyRate),
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
      })),
      pagination: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async earnings(user: AuthenticatedUser, query: EarningsQueryDto) {
    const now = new Date();
    const from = query.from ? new Date(query.from) : startOfMonth(now);
    const to = query.to ? new Date(query.to) : now;

    if (from > to) {
      throw new BadRequestException({
        code: 'INVALID_DATE_RANGE',
        message: 'La fecha inicial no puede ser posterior a la fecha final',
      });
    }

    const [approvedPayments, refundedPayments] = await Promise.all([
      this.prisma.payment.findMany({
        where: {
          tutorId: user.id,
          status: 'APPROVED',
          paidAt: { gte: from, lte: to },
          booking: { status: BookingStatus.COMPLETED },
        },
        orderBy: { paidAt: 'asc' },
        include: {
          booking: { include: { subject: true } },
        },
      }),
      this.prisma.payment.findMany({
        where: {
          tutorId: user.id,
          status: 'REFUNDED',
          refundedAt: { gte: from, lte: to },
        },
        orderBy: { refundedAt: 'asc' },
        include: {
          booking: { include: { subject: true } },
        },
      }),
    ]);

    const periods = new Map<
      string,
      { periodStart: Date; gross: number; platformFees: number; netEarnings: number; sessions: number }
    >();

    for (const payment of approvedPayments) {
      const referenceDate = payment.paidAt ?? payment.createdAt;
      const periodStart = this.periodStart(referenceDate, query.groupBy);
      const key = periodStart.toISOString();
      const current = periods.get(key) ?? {
        periodStart,
        gross: 0,
        platformFees: 0,
        netEarnings: 0,
        sessions: 0,
      };

      current.gross = roundMoney(current.gross + money(payment.amount));
      current.platformFees = roundMoney(current.platformFees + money(payment.platformFee));
      current.netEarnings = roundMoney(current.netEarnings + money(payment.tutorEarnings));
      current.sessions += 1;
      periods.set(key, current);
    }

    const totals = approvedPayments.reduce(
      (accumulator, payment) => ({
        gross: roundMoney(accumulator.gross + money(payment.amount)),
        platformFees: roundMoney(accumulator.platformFees + money(payment.platformFee)),
        netEarnings: roundMoney(accumulator.netEarnings + money(payment.tutorEarnings)),
        sessions: accumulator.sessions + 1,
      }),
      { gross: 0, platformFees: 0, netEarnings: 0, sessions: 0 },
    );

    const refundedTotal = refundedPayments.reduce(
      (total, payment) => roundMoney(total + money(payment.amount)),
      0,
    );

    return {
      simulated: true,
      disclaimer:
        'Los ingresos mostrados son simulados para el MVP y no representan transferencias bancarias reales.',
      currency: 'COP',
      period: { from, to, groupBy: query.groupBy },
      totals: {
        ...totals,
        refundedTotal,
        refundedSessions: refundedPayments.length,
      },
      periods: [...periods.values()].sort(
        (first, second) => first.periodStart.getTime() - second.periodStart.getTime(),
      ),
      sessions: approvedPayments
        .map((payment) => ({
          paymentId: payment.id,
          reference: payment.reference,
          bookingId: payment.bookingId,
          sessionDate: payment.booking.startAt,
          paidAt: payment.paidAt,
          subject: payment.booking.subject,
          studentAlias: this.alias(payment.studentId),
          durationMinutes: payment.booking.durationMinutes,
          subtotal: money(payment.booking.subtotal),
          platformFee: money(payment.platformFee),
          total: money(payment.amount),
          tutorEarnings: money(payment.tutorEarnings),
          status: payment.status,
          simulated: payment.simulated,
        }))
        .sort((first, second) => second.sessionDate.getTime() - first.sessionDate.getTime()),
    };
  }

  async search(query: TutorSearchQueryDto) {
    const now = new Date();
    const subjectFilter: Prisma.SubjectWhereInput = {
      ...(query.subjectId ? { id: query.subjectId } : {}),
      ...(query.programId ? { programId: query.programId } : {}),
      ...(query.facultyId ? { program: { facultyId: query.facultyId } } : {}),
    };
    const hasSubjectFilter = Boolean(query.subjectId || query.programId || query.facultyId);

    const where: Prisma.TutorProfileWhereInput = {
      verificationStatus: VerificationStatus.VERIFIED,
      isActive: true,
      user: { status: UserStatus.ACTIVE },
      ...(query.minRating !== undefined ? { averageRating: { gte: query.minRating } } : {}),
      ...(query.maxRate !== undefined ? { hourlyRate: { lte: query.maxRate } } : {}),
      ...(query.modality ? { modalities: { has: query.modality } } : {}),
      ...(query.professorId
        ? { professors: { some: { professorId: query.professorId } } }
        : {}),
      ...(hasSubjectFilter
        ? {
            subjects: {
              some: {
                status: VerificationStatus.VERIFIED,
                subject: subjectFilter,
              },
            },
          }
        : {}),
      ...(query.q
        ? {
            OR: [
              { user: { fullName: { contains: query.q, mode: 'insensitive' } } },
              { bio: { contains: query.q, mode: 'insensitive' } },
              {
                subjects: {
                  some: {
                    status: VerificationStatus.VERIFIED,
                    subject: {
                      OR: [
                        { name: { contains: query.q, mode: 'insensitive' } },
                        { code: { contains: query.q, mode: 'insensitive' } },
                      ],
                    },
                  },
                },
              },
            ],
          }
        : {}),
    };

    const include = {
      user: { select: { fullName: true } },
      subjects: {
        where: { status: VerificationStatus.VERIFIED },
        include: { subject: { select: { id: true, code: true, name: true } } },
      },
      professors: {
        include: { professor: { select: { id: true, fullName: true } } },
      },
      availability: {
        where: { status: SlotStatus.AVAILABLE, startAt: { gt: now } },
        orderBy: { startAt: 'asc' as const },
        take: 1,
      },
    } satisfies Prisma.TutorProfileInclude;

    if (query.sortBy === TutorSortBy.AVAILABILITY) {
      const rows = await this.prisma.tutorProfile.findMany({ where, include });
      const mapped = rows.map((row) => this.mapTutorCard(row));
      mapped.sort((first, second) => {
        const firstTime = first.nextAvailableAt
          ? new Date(first.nextAvailableAt).getTime()
          : Number.POSITIVE_INFINITY;
        const secondTime = second.nextAvailableAt
          ? new Date(second.nextAvailableAt).getTime()
          : Number.POSITIVE_INFINITY;

        if (firstTime !== secondTime) {
          return firstTime - secondTime;
        }

        return second.averageRating - first.averageRating;
      });

      const total = mapped.length;
      const items = mapped.slice(
        getPaginationSkip(query.page, query.limit),
        getPaginationSkip(query.page, query.limit) + query.limit,
      );

      return {
        items,
        pagination: buildPaginationMeta(query.page, query.limit, total),
        suggestions:
          total === 0
            ? 'No hay tutores compatibles. Ajusta los filtros o usa StudyMatch para una busqueda urgente.'
            : null,
      };
    }

    const orderBy: Prisma.TutorProfileOrderByWithRelationInput[] =
      query.sortBy === TutorSortBy.PRICE
        ? [{ hourlyRate: 'asc' }]
        : query.sortBy === TutorSortBy.RATING
          ? [{ averageRating: 'desc' }, { reviewCount: 'desc' }]
          : [{ averageRating: 'desc' }, { reviewCount: 'desc' }, { createdAt: 'desc' }];

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.tutorProfile.findMany({
        where,
        include,
        orderBy,
        skip: getPaginationSkip(query.page, query.limit),
        take: query.limit,
      }),
      this.prisma.tutorProfile.count({ where }),
    ]);

    return {
      items: rows.map((row) => this.mapTutorCard(row)),
      pagination: buildPaginationMeta(query.page, query.limit, total),
      suggestions:
        total === 0
          ? 'No hay tutores compatibles. Ajusta los filtros o usa StudyMatch para una busqueda urgente.'
          : null,
    };
  }

  async publicProfile(tutorProfileId: string) {
    const profile = await this.prisma.tutorProfile.findFirst({
      where: {
        id: tutorProfileId,
        verificationStatus: VerificationStatus.VERIFIED,
        isActive: true,
        user: { status: UserStatus.ACTIVE },
      },
      include: {
        user: true,
        subjects: {
          where: { status: VerificationStatus.VERIFIED },
          include: {
            subject: {
              include: { program: { include: { faculty: true } } },
            },
          },
        },
        professors: { include: { professor: true } },
        availability: {
          where: { status: SlotStatus.AVAILABLE, startAt: { gt: new Date() } },
          orderBy: { startAt: 'asc' },
          take: 5,
        },
      },
    });

    if (!profile) {
      throw new NotFoundException({
        code: 'TUTOR_NOT_FOUND',
        message: 'El tutor no existe o no esta disponible',
      });
    }

    const [reviews, completedSessions] = await Promise.all([
      this.prisma.review.findMany({
        where: { tutorId: profile.userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { booking: { include: { subject: true } } },
      }),
      this.prisma.booking.count({
        where: { tutorId: profile.userId, status: BookingStatus.COMPLETED },
      }),
    ]);

    return {
      id: profile.id,
      userId: profile.userId,
      fullName: profile.user.fullName,
      bio: profile.bio,
      experienceYears: profile.experienceYears,
      hourlyRate: money(profile.hourlyRate),
      modalities: profile.modalities,
      verificationStatus: profile.verificationStatus,
      averageRating: roundMoney(profile.averageRating),
      reviewCount: profile.reviewCount,
      hasReviews: profile.reviewCount > 0,
      completedSessions,
      subjects: profile.subjects.map((link) => ({
        id: link.subject.id,
        code: link.subject.code,
        name: link.subject.name,
        program: link.subject.program.name,
        faculty: link.subject.program.faculty.name,
        status: link.status,
      })),
      professors: profile.professors.map((link) => link.professor),
      nextAvailability: profile.availability.map((slot) => this.mapSlot(slot)),
      recentReviews: reviews.map((review) => ({
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt,
        subject: review.booking.subject.name,
      })),
    };
  }

  async publicReviews(tutorProfileId: string, page: number, limit: number) {
    const profile = await this.prisma.tutorProfile.findFirst({
      where: {
        id: tutorProfileId,
        verificationStatus: VerificationStatus.VERIFIED,
        isActive: true,
      },
      select: { userId: true },
    });

    if (!profile) {
      throw new NotFoundException({
        code: 'TUTOR_NOT_FOUND',
        message: 'El tutor no existe o no esta disponible',
      });
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where: { tutorId: profile.userId },
        orderBy: { createdAt: 'desc' },
        skip: getPaginationSkip(page, limit),
        take: limit,
        include: { booking: { include: { subject: true } } },
      }),
      this.prisma.review.count({ where: { tutorId: profile.userId } }),
    ]);

    return {
      items: items.map((review) => ({
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt,
        subject: review.booking.subject.name,
        verifiedSession: true,
      })),
      pagination: buildPaginationMeta(page, limit, total),
      hasReviews: total > 0,
      message: total === 0 ? 'Este tutor aun no tiene resenas verificadas.' : null,
    };
  }

  private async requireTutorProfile(userId: string) {
    const profile = await this.prisma.tutorProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException({
        code: 'TUTOR_PROFILE_NOT_FOUND',
        message: 'No tienes un perfil de tutor',
      });
    }

    return profile;
  }

  private async requireVerifiedProfile(userId: string) {
    const profile = await this.requireTutorProfile(userId);

    if (profile.verificationStatus !== VerificationStatus.VERIFIED) {
      throw new ForbiddenException({
        code: 'TUTOR_NOT_VERIFIED',
        message: 'Solo un tutor verificado puede realizar esta accion',
      });
    }

    return profile;
  }

  private async requireOwnedSlot(userId: string, slotId: string) {
    const slot = await this.prisma.availabilitySlot.findUnique({
      where: { id: slotId },
      include: { tutor: { select: { userId: true } } },
    });

    if (!slot || slot.tutor.userId !== userId) {
      throw new NotFoundException({
        code: 'AVAILABILITY_NOT_FOUND',
        message: 'La franja de disponibilidad no existe',
      });
    }

    return slot;
  }

  private async assertSlotHasNoHistory(slotId: string) {
    const [bookingCount, proposalCount] = await this.prisma.$transaction([
      this.prisma.booking.count({ where: { slotId } }),
      this.prisma.studyMatchProposal.count({ where: { slotId } }),
    ]);

    if (bookingCount > 0 || proposalCount > 0) {
      throw new ConflictException({
        code: 'SLOT_HAS_HISTORY',
        message:
          'La franja tiene reservas o propuestas asociadas. Crea una nueva franja para no alterar el historial.',
      });
    }
  }

  private validateSlotRange(startAt: Date, endAt: Date) {
    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
      throw new BadRequestException({
        code: 'INVALID_DATE',
        message: 'Las fechas de la franja no son validas',
      });
    }

    if (startAt <= new Date()) {
      throw new BadRequestException({
        code: 'SLOT_IN_PAST',
        message: 'La franja debe iniciar en el futuro',
      });
    }

    if (endAt <= startAt) {
      throw new BadRequestException({
        code: 'INVALID_SLOT_RANGE',
        message: 'La hora final debe ser posterior a la hora inicial',
      });
    }

    const durationMinutes = (endAt.getTime() - startAt.getTime()) / 60_000;
    if (durationMinutes < 30 || durationMinutes > 480) {
      throw new BadRequestException({
        code: 'INVALID_SLOT_DURATION',
        message: 'La franja debe durar entre 30 minutos y 8 horas',
      });
    }
  }

  private alias(studentId: string): string {
    return anonymizeStudentId(
      studentId,
      this.config.getOrThrow<string>('security.anonymitySalt'),
    );
  }

  private periodStart(date: Date, groupBy: EarningsGroupBy): Date {
    if (groupBy === EarningsGroupBy.DAY) {
      return startOfDay(date);
    }

    if (groupBy === EarningsGroupBy.WEEK) {
      return startOfWeek(date);
    }

    return startOfMonth(date);
  }

  private mapSlot(slot: {
    id: string;
    startAt: Date;
    endAt: Date;
    modality: Modality;
    status: SlotStatus;
    heldUntil: Date | null;
  }) {
    return {
      id: slot.id,
      startAt: slot.startAt,
      endAt: slot.endAt,
      modality: slot.modality,
      status: slot.status,
      heldUntil: slot.heldUntil,
    };
  }

  private mapTutorCard(tutor: TutorCardData) {
    const nextSlot = tutor.availability[0] ?? null;

    return {
      id: tutor.id,
      userId: tutor.userId,
      fullName: tutor.user.fullName,
      bio: tutor.bio,
      experienceYears: tutor.experienceYears,
      hourlyRate: money(tutor.hourlyRate),
      modalities: tutor.modalities,
      averageRating: roundMoney(tutor.averageRating),
      reviewCount: tutor.reviewCount,
      hasReviews: tutor.reviewCount > 0,
      subjects: tutor.subjects.map((link) => ({
        id: link.subject.id,
        code: link.subject.code,
        name: link.subject.name,
      })),
      professors: tutor.professors.map((link) => ({
        id: link.professor.id,
        fullName: link.professor.fullName,
      })),
      nextAvailableAt: nextSlot?.startAt ?? null,
      isAvailable: Boolean(nextSlot),
    };
  }

  private mapOwnProfile(profile: {
    id: string;
    userId: string;
    bio: string | null;
    experienceYears: number;
    hourlyRate: Prisma.Decimal;
    verificationStatus: VerificationStatus;
    rejectionReason: string | null;
    verifiedAt: Date | null;
    averageRating: number;
    reviewCount: number;
    modalities: Modality[];
    isActive: boolean;
    maxWeeklySessions: number | null;
    user: { fullName: string; email: string };
    subjects: Array<{
      id: string;
      status: VerificationStatus;
      evidenceUrl: string | null;
      rejectionReason: string | null;
      subject: { id: string; code: string; name: string };
    }>;
    professors: Array<{ professor: { id: string; fullName: string } }>;
    availability: Array<{
      id: string;
      startAt: Date;
      endAt: Date;
      modality: Modality;
      status: SlotStatus;
      heldUntil: Date | null;
    }>;
  }) {
    return {
      id: profile.id,
      userId: profile.userId,
      fullName: profile.user.fullName,
      email: profile.user.email,
      bio: profile.bio,
      experienceYears: profile.experienceYears,
      hourlyRate: money(profile.hourlyRate),
      verificationStatus: profile.verificationStatus,
      rejectionReason: profile.rejectionReason,
      verifiedAt: profile.verifiedAt,
      averageRating: roundMoney(profile.averageRating),
      reviewCount: profile.reviewCount,
      modalities: profile.modalities,
      isActive: profile.isActive,
      maxWeeklySessions: profile.maxWeeklySessions,
      subjects: profile.subjects.map((link) => ({
        id: link.id,
        status: link.status,
        evidenceUrl: link.evidenceUrl,
        rejectionReason: link.rejectionReason,
        subject: link.subject,
      })),
      professors: profile.professors.map((link) => link.professor),
      nextAvailability: profile.availability.map((slot) => this.mapSlot(slot)),
    };
  }
}
