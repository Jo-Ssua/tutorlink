import { randomUUID } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
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
  Urgency,
  UserStatus,
  VerificationStatus,
} from '@prisma/client';
import { buildPaginationMeta, getPaginationSkip } from '../common/dto/pagination.dto';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { anonymizeStudentId } from '../common/utils/anonymize';
import { addDays, addMinutes, differenceInMinutes, formatDateTime, maxDate } from '../common/utils/date';
import { compatibleModalities } from '../common/utils/modality';
import { calculatePrice, money, roundMoney } from '../common/utils/money';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  ConfirmProposalDto,
  CreateStudyMatchRequestDto,
  ProposalResponseAction,
  RespondProposalDto,
  StudyMatchRequestListQueryDto,
} from './dto/studymatch.dto';
import {
  ScoreResult,
  ScoringCandidate,
  ScoringService,
  ScoringWeights,
} from './scoring.service';

class SlotUnavailableError extends Error {}

@Injectable()
export class StudyMatchService {
  private readonly logger = new Logger(StudyMatchService.name);
  private expiring = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
    private readonly scoring: ScoringService,
  ) {}

  async createRequest(user: AuthenticatedUser, dto: CreateStudyMatchRequestDto) {
    const now = new Date();
    const requestedFrom = new Date(dto.availableFrom);
    const availableTo = new Date(dto.availableTo);
    const availableFrom = requestedFrom < now ? now : requestedFrom;

    if (availableTo <= now) {
      throw new BadRequestException({
        code: 'AVAILABILITY_WINDOW_IN_PAST',
        message: 'La ventana de disponibilidad debe terminar en el futuro',
      });
    }

    if (availableFrom >= availableTo) {
      throw new BadRequestException({
        code: 'INVALID_AVAILABILITY_WINDOW',
        message: 'La fecha inicial de disponibilidad debe ser anterior a la final',
      });
    }

    if (availableTo > addDays(now, 30)) {
      throw new BadRequestException({
        code: 'AVAILABILITY_WINDOW_TOO_LONG',
        message: 'StudyMatch acepta ventanas de disponibilidad de hasta 30 dias',
      });
    }

    const subject = await this.prisma.subject.findUnique({
      where: { id: dto.subjectId },
      include: { program: true },
    });

    if (!subject) {
      throw new NotFoundException({
        code: 'SUBJECT_NOT_FOUND',
        message: 'La materia no pertenece al pensum oficial',
      });
    }

    if (dto.professorId) {
      const professor = await this.prisma.professor.findUnique({
        where: { id: dto.professorId },
        include: { subjectLinks: { select: { subjectId: true } } },
      });

      if (!professor || !professor.subjectLinks.some((link) => link.subjectId === dto.subjectId)) {
        throw new BadRequestException({
          code: 'PROFESSOR_SUBJECT_MISMATCH',
          message: 'El profesor indicado no dicta la materia seleccionada',
        });
      }
    }

    const activeRequest = await this.prisma.tutoringRequest.findFirst({
      where: {
        studentId: user.id,
        status: {
          in: [
            TutoringRequestStatus.SEARCHING,
            TutoringRequestStatus.PROPOSAL_SENT,
            TutoringRequestStatus.AWAITING_STUDENT,
          ],
        },
      },
      select: { id: true, status: true },
    });

    if (activeRequest) {
      throw new ConflictException({
        code: 'ACTIVE_STUDYMATCH_REQUEST',
        message: 'Ya tienes una solicitud StudyMatch activa',
        details: { activeRequestId: activeRequest.id, status: activeRequest.status },
      });
    }

    const request = await this.prisma.tutoringRequest.create({
      data: {
        studentId: user.id,
        subjectId: dto.subjectId,
        professorId: dto.professorId,
        topic: dto.topic,
        description: dto.description,
        urgency: dto.urgency,
        modality: dto.modality,
        availableFrom,
        availableTo,
        status: TutoringRequestStatus.SEARCHING,
      },
      include: { subject: true, professor: true },
    });

    await this.notifications.create({
      userId: user.id,
      type: 'TUTORING_REQUEST_CREATED',
      title: 'Solicitud StudyMatch creada',
      message: `Iniciamos la busqueda de un tutor para ${subject.name}.`,
      data: { requestId: request.id, urgency: request.urgency },
    });

    return this.assignNextCandidate(request.id);
  }

  async myRequests(user: AuthenticatedUser, query: StudyMatchRequestListQueryDto) {
    const where: Prisma.TutoringRequestWhereInput = {
      studentId: user.id,
      ...(query.status ? { status: query.status } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.tutoringRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: getPaginationSkip(query.page, query.limit),
        take: query.limit,
        include: {
          subject: true,
          professor: true,
          proposals: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: {
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
              slot: true,
            },
          },
          booking: { include: { payments: { orderBy: { createdAt: 'desc' }, take: 1 } } },
        },
      }),
      this.prisma.tutoringRequest.count({ where }),
    ]);

    return {
      items: items.map((request) => ({
        id: request.id,
        status: request.status,
        topic: request.topic,
        description: request.description,
        urgency: request.urgency,
        modality: request.modality,
        availableFrom: request.availableFrom,
        availableTo: request.availableTo,
        createdAt: request.createdAt,
        subject: request.subject,
        professor: request.professor,
        latestProposal: request.proposals[0]
          ? this.mapProposalForStudent(request.proposals[0])
          : null,
        booking: request.booking
          ? this.mapBookingSummary(request.booking, request.subject)
          : null,
      })),
      pagination: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async getRequest(user: AuthenticatedUser, requestId: string) {
    const request = await this.findRequestWithRelations(requestId);

    if (
      user.role !== Role.ADMIN &&
      request.studentId !== user.id &&
      !request.proposals.some((proposal) => proposal.tutorId === user.id)
    ) {
      throw new NotFoundException({
        code: 'STUDYMATCH_REQUEST_NOT_FOUND',
        message: 'La solicitud StudyMatch no existe',
      });
    }

    const view =
      user.role === Role.ADMIN ? 'admin' : request.studentId === user.id ? 'student' : 'tutor';

    return this.mapRequestForView(request, view, user.id);
  }

  async pendingProposals(user: AuthenticatedUser) {
    const now = new Date();
    const proposals = await this.prisma.studyMatchProposal.findMany({
      where: {
        tutorId: user.id,
        status: ProposalStatus.PENDING_TUTOR,
        expiresAt: { gt: now },
      },
      orderBy: { expiresAt: 'asc' },
      take: 50,
      include: {
        request: {
          include: {
            subject: true,
            professor: true,
            student: { select: { id: true } },
          },
        },
        slot: true,
      },
    });

    return {
      items: proposals.map((proposal) =>
        this.mapProposalForTutor(proposal, proposal.request),
      ),
      total: proposals.length,
    };
  }

  async respondProposal(
    user: AuthenticatedUser,
    proposalId: string,
    dto: RespondProposalDto,
  ) {
    const proposal = await this.prisma.studyMatchProposal.findUnique({
      where: { id: proposalId },
      include: {
        request: { include: { subject: true, professor: true, student: { select: { id: true } } } },
        slot: true,
        booking: true,
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
                verificationStatus: true,
                isActive: true,
              },
            },
          },
        },
      },
    });

    if (!proposal || proposal.tutorId !== user.id) {
      throw new NotFoundException({
        code: 'STUDYMATCH_PROPOSAL_NOT_FOUND',
        message: 'La propuesta StudyMatch no existe',
      });
    }

    if (proposal.status !== ProposalStatus.PENDING_TUTOR) {
      throw new ConflictException({
        code: 'INVALID_PROPOSAL_STATE',
        message: `La propuesta ya fue atendida. Estado actual: ${proposal.status}`,
      });
    }

    if (proposal.expiresAt <= new Date()) {
      await this.expireProposalById(proposal.id);
      const next = await this.assignNextCandidate(proposal.requestId);
      throw new ConflictException({
        code: 'PROPOSAL_EXPIRED',
        message: 'La propuesta expiro y StudyMatch continua con el siguiente tutor elegible',
        details: { next },
      });
    }

    if (dto.action === ProposalResponseAction.REJECT) {
      const now = new Date();
      const updated = await this.prisma.$transaction(async (tx) => {
        const result = await tx.studyMatchProposal.updateMany({
          where: { id: proposal.id, status: ProposalStatus.PENDING_TUTOR },
          data: {
            status: ProposalStatus.TUTOR_REJECTED,
            respondedAt: now,
            rejectionReason: dto.reason,
          },
        });

        if (result.count === 0) {
          throw new ConflictException({
            code: 'INVALID_PROPOSAL_STATE',
            message: 'La propuesta ya fue atendida',
          });
        }

        await tx.tutoringRequest.updateMany({
          where: {
            id: proposal.requestId,
            status: {
              in: [
                TutoringRequestStatus.PROPOSAL_SENT,
                TutoringRequestStatus.AWAITING_STUDENT,
              ],
            },
          },
          data: { status: TutoringRequestStatus.SEARCHING },
        });

        await this.releaseSlotAfterProposal(tx, proposal.slotId);
        return tx.studyMatchProposal.findUniqueOrThrow({
          where: { id: proposal.id },
          include: { request: { include: { subject: true, professor: true } }, slot: true },
        });
      });

      await this.notifications.create({
        userId: proposal.request.studentId,
        type: 'STUDYMATCH_PROPOSAL_REJECTED',
        title: 'Tutor no disponible',
        message: 'El tutor rechazo la solicitud. StudyMatch busca otra alternativa.',
        data: { requestId: proposal.requestId, proposalId: proposal.id },
      });

      const next = await this.assignNextCandidate(proposal.requestId);

      return {
        proposal: this.mapProposalForTutor(updated, updated.request),
        next,
        message: 'Propuesta rechazada. StudyMatch continua con el siguiente tutor elegible.',
      };
    }

    const tutorProfile = proposal.tutor.tutorProfile;

    if (
      !tutorProfile ||
      tutorProfile.verificationStatus !== VerificationStatus.VERIFIED ||
      !tutorProfile.isActive
    ) {
      throw new ConflictException({
        code: 'TUTOR_NOT_AVAILABLE',
        message: 'El perfil del tutor ya no esta disponible para recibir la solicitud',
      });
    }

    const durationMinutes = differenceInMinutes(proposal.slot.startAt, proposal.slot.endAt);
    const price = calculatePrice(
      money(tutorProfile.hourlyRate),
      durationMinutes,
      this.config.getOrThrow<number>('platformFeePercent'),
    );
    const studentConfirmExpiresAt = addMinutes(
      new Date(),
      this.config.getOrThrow<number>('studyMatch.studentConfirmMinutes'),
    );

    const accepted = await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const update = await tx.studyMatchProposal.updateMany({
        where: {
          id: proposal.id,
          status: ProposalStatus.PENDING_TUTOR,
          expiresAt: { gt: now },
        },
        data: {
          status: ProposalStatus.TUTOR_ACCEPTED,
          respondedAt: now,
          expiresAt: studentConfirmExpiresAt,
        },
      });

      if (update.count === 0) {
        throw new ConflictException({
          code: 'PROPOSAL_EXPIRED',
          message: 'La propuesta expiro antes de ser aceptada',
        });
      }

      await tx.availabilitySlot.update({
        where: { id: proposal.slotId },
        data: { heldUntil: studentConfirmExpiresAt },
      });

      const booking = await tx.booking.create({
        data: {
          studentId: proposal.request.studentId,
          tutorId: proposal.tutorId,
          subjectId: proposal.request.subjectId,
          slotId: proposal.slotId,
          requestId: proposal.requestId,
          proposalId: proposal.id,
          topic: proposal.request.topic,
          description: proposal.request.description,
          modality: proposal.slot.modality,
          startAt: proposal.slot.startAt,
          endAt: proposal.slot.endAt,
          status: BookingStatus.ACCEPTED,
          hourlyRate: price.hourlyRate.toFixed(2),
          durationMinutes,
          subtotal: price.subtotal.toFixed(2),
          platformFee: price.platformFee.toFixed(2),
          total: price.total.toFixed(2),
          isEmergency: true,
        },
      });

      await tx.tutoringRequest.update({
        where: { id: proposal.requestId },
        data: { status: TutoringRequestStatus.AWAITING_STUDENT },
      });

      const updatedProposal = await tx.studyMatchProposal.findUniqueOrThrow({
        where: { id: proposal.id },
        include: {
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
          slot: true,
          booking: true,
        },
      });

      return { proposal: updatedProposal, booking };
    });

    await this.notifications.createMany([
      {
        userId: proposal.request.studentId,
        type: 'STUDYMATCH_PROPOSAL_ACCEPTED',
        title: 'Tutor disponible para tu urgencia',
        message: `${proposal.tutor.fullName} acepto la solicitud de ${proposal.request.subject.name}. Revisa condiciones y confirma el pago simulado antes de ${formatDateTime(
          studentConfirmExpiresAt,
        )}.`,
        data: {
          proposalId: proposal.id,
          requestId: proposal.requestId,
          bookingId: accepted.booking.id,
          tutorName: proposal.tutor.fullName,
          rating: roundMoney(tutorProfile.averageRating),
          subject: proposal.request.subject.name,
          startAt: proposal.slot.startAt.toISOString(),
          endAt: proposal.slot.endAt.toISOString(),
          modality: proposal.slot.modality,
          hourlyRate: price.hourlyRate,
          total: price.total,
          expiresAt: studentConfirmExpiresAt.toISOString(),
        },
      },
      {
        userId: proposal.tutorId,
        type: 'STUDYMATCH_PROPOSAL',
        title: 'Propuesta aceptada',
        message: 'Aceptaste la solicitud urgente. Esperando la confirmacion del estudiante.',
        data: { proposalId: proposal.id, requestId: proposal.requestId },
      },
    ]);

    return {
      proposal: this.mapProposalForStudent(accepted.proposal),
      booking: this.mapBookingSummary(accepted.booking, proposal.request.subject),
      price,
      expiresAt: studentConfirmExpiresAt,
      message:
        'Propuesta aceptada. El estudiante debe confirmar condiciones y pago simulado dentro del plazo.',
    };
  }

  async confirmProposal(
    user: AuthenticatedUser,
    proposalId: string,
    dto: ConfirmProposalDto,
  ) {
    const proposal = await this.prisma.studyMatchProposal.findUnique({
      where: { id: proposalId },
      include: {
        request: { include: { subject: true, professor: true } },
        slot: true,
        booking: { include: { payments: { orderBy: { createdAt: 'desc' }, take: 1 } } },
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
      },
    });

    if (!proposal || proposal.request.studentId !== user.id) {
      throw new NotFoundException({
        code: 'STUDYMATCH_PROPOSAL_NOT_FOUND',
        message: 'La propuesta StudyMatch no existe',
      });
    }

    if (proposal.status !== ProposalStatus.TUTOR_ACCEPTED) {
      throw new ConflictException({
        code: 'INVALID_PROPOSAL_STATE',
        message: `La propuesta no esta pendiente de confirmacion del estudiante. Estado: ${proposal.status}`,
      });
    }

    if (proposal.expiresAt <= new Date()) {
      await this.expireProposalById(proposal.id);
      const next = await this.assignNextCandidate(proposal.requestId);
      throw new ConflictException({
        code: 'PROPOSAL_EXPIRED',
        message: 'El tiempo para confirmar la propuesta expiro. StudyMatch busca otra alternativa.',
        details: { next },
      });
    }

    if (!dto.accept) {
      const updated = await this.prisma.$transaction(async (tx) => {
        const now = new Date();
        const result = await tx.studyMatchProposal.updateMany({
          where: { id: proposal.id, status: ProposalStatus.TUTOR_ACCEPTED },
          data: {
            status: ProposalStatus.STUDENT_REJECTED,
            respondedAt: now,
            rejectionReason: dto.rejectionReason,
          },
        });

        if (result.count === 0) {
          throw new ConflictException({
            code: 'INVALID_PROPOSAL_STATE',
            message: 'La propuesta ya fue atendida',
          });
        }

        if (proposal.booking) {
          await tx.booking.updateMany({
            where: { id: proposal.booking.id, status: BookingStatus.ACCEPTED },
            data: {
              status: BookingStatus.CANCELLED,
              cancellationReason: dto.rejectionReason ?? 'Propuesta rechazada por el estudiante',
              cancelledAt: now,
            },
          });
        }

        await tx.tutoringRequest.updateMany({
          where: { id: proposal.requestId },
          data: { status: TutoringRequestStatus.SEARCHING },
        });

        await this.releaseSlotAfterProposal(tx, proposal.slotId);

        return tx.studyMatchProposal.findUniqueOrThrow({
          where: { id: proposal.id },
          include: {
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
            slot: true,
            booking: true,
          },
        });
      });

      await this.notifications.create({
        userId: proposal.tutorId,
        type: 'STUDYMATCH_PROPOSAL_REJECTED',
        title: 'Propuesta rechazada por el estudiante',
        message: 'El estudiante rechazo la propuesta. StudyMatch busca otra alternativa.',
        data: { proposalId: proposal.id, requestId: proposal.requestId },
      });

      const next = await this.assignNextCandidate(proposal.requestId);

      return {
        proposal: this.mapProposalForStudent(updated),
        next,
        message: 'Propuesta rechazada. StudyMatch continua con el siguiente tutor elegible.',
      };
    }

    if (!dto.simulatePayment) {
      throw new BadRequestException({
        code: 'SIMULATED_PAYMENT_REQUIRED',
        message: 'Debes confirmar el pago simulado para reservar la sesion',
      });
    }

    if (!proposal.booking) {
      throw new ConflictException({
        code: 'BOOKING_NOT_FOUND',
        message: 'La reserva asociada a la propuesta no existe',
      });
    }

    const bookingId = proposal.booking.id;
    const reference = this.paymentReference();
    const confirmed = await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const proposalUpdate = await tx.studyMatchProposal.updateMany({
        where: {
          id: proposal.id,
          status: ProposalStatus.TUTOR_ACCEPTED,
          expiresAt: { gt: now },
        },
        data: { status: ProposalStatus.CONFIRMED, respondedAt: now },
      });

      if (proposalUpdate.count === 0) {
        throw new ConflictException({
          code: 'PROPOSAL_EXPIRED',
          message: 'La propuesta expiro antes de la confirmacion',
        });
      }

      const bookingUpdate = await tx.booking.updateMany({
        where: { id: bookingId, status: BookingStatus.ACCEPTED },
        data: { status: BookingStatus.CONFIRMED },
      });

      if (bookingUpdate.count === 0) {
        throw new ConflictException({
          code: 'INVALID_BOOKING_STATE',
          message: 'La reserva asociada ya no esta pendiente de confirmacion',
        });
      }

      await tx.tutoringRequest.update({
        where: { id: proposal.requestId },
        data: { status: TutoringRequestStatus.CONFIRMED },
      });

      await tx.availabilitySlot.update({
        where: { id: proposal.slotId },
        data: { status: SlotStatus.RESERVED, heldUntil: null },
      });

      const payment = await tx.payment.create({
        data: {
          bookingId: bookingId,
          studentId: user.id,
          tutorId: proposal.tutorId,
          amount: proposal.booking!.total,
          platformFee: proposal.booking!.platformFee,
          tutorEarnings: proposal.booking!.subtotal,
          currency: 'COP',
          type: 'SIMULATED',
          status: PaymentStatus.APPROVED,
          reference,
          simulated: true,
          paidAt: now,
        },
      });

      const booking = await tx.booking.findUniqueOrThrow({
        where: { id: bookingId },
        include: {
          subject: true,
          payments: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      });

      return { payment, booking };
    });

    await this.notifications.createMany([
      {
        userId: proposal.tutorId,
        type: 'STUDYMATCH_REQUEST_CONFIRMED',
        title: 'Reserva de emergencia confirmada',
        message: `El estudiante confirmo la sesion urgente de ${proposal.request.subject.name} para ${formatDateTime(
          proposal.slot.startAt,
        )}.`,
        data: {
          proposalId: proposal.id,
          requestId: proposal.requestId,
          bookingId,
          paymentReference: confirmed.payment.reference,
          simulated: true,
        },
      },
      {
        userId: user.id,
        type: 'STUDYMATCH_REQUEST_CONFIRMED',
        title: 'Reserva de emergencia confirmada',
        message: 'Tu pago simulado fue aprobado y la sesion quedo reservada.',
        data: {
          proposalId: proposal.id,
          requestId: proposal.requestId,
          bookingId,
          paymentReference: confirmed.payment.reference,
          simulated: true,
        },
      },
    ]);

    return {
      proposal: this.mapProposalForStudent({
        ...proposal,
        status: ProposalStatus.CONFIRMED,
      }),
      booking: this.mapBookingSummary(confirmed.booking, proposal.request.subject),
      payment: {
        id: confirmed.payment.id,
        reference: confirmed.payment.reference,
        status: confirmed.payment.status,
        amount: money(confirmed.payment.amount),
        simulated: confirmed.payment.simulated,
        paidAt: confirmed.payment.paidAt,
      },
      disclaimer:
        'Pago simulado aprobado. No se proceso ningun dato bancario ni transferencia real.',
      message: 'Sesion reservada y confirmada.',
    };
  }

  async cancelRequest(user: AuthenticatedUser, requestId: string) {
    const request = await this.prisma.tutoringRequest.findUnique({
      where: { id: requestId },
      include: {
        subject: true,
        professor: true,
        proposals: true,
        booking: { include: { payments: true } },
      },
    });

    if (!request || (user.role !== Role.ADMIN && request.studentId !== user.id)) {
      throw new NotFoundException({
        code: 'STUDYMATCH_REQUEST_NOT_FOUND',
        message: 'La solicitud StudyMatch no existe',
      });
    }

    if (request.status === TutoringRequestStatus.CONFIRMED) {
      throw new ConflictException({
        code: 'USE_BOOKING_CANCELLATION',
        message: 'La solicitud ya tiene una reserva confirmada. Cancela desde /bookings.',
      });
    }

    if (
      [TutoringRequestStatus.CANCELLED, TutoringRequestStatus.EXPIRED].some(
        (status) => status === request.status,
      )
    ) {
      throw new ConflictException({
        code: 'INVALID_REQUEST_STATE',
        message: `La solicitud ya esta en estado ${request.status}`,
      });
    }

    const activeProposalTutorIds = request.proposals
      .filter((proposal) =>
        [ProposalStatus.PENDING_TUTOR, ProposalStatus.TUTOR_ACCEPTED].some(
          (status) => status === proposal.status,
        ),
      )
      .map((proposal) => proposal.tutorId);

    const slotIds = new Set<string>();
    request.proposals.forEach((proposal) => slotIds.add(proposal.slotId));
    if (request.booking) {
      slotIds.add(request.booking.slotId);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.tutoringRequest.update({
        where: { id: request.id },
        data: { status: TutoringRequestStatus.CANCELLED, cancelledAt: new Date() },
      });

      await tx.studyMatchProposal.updateMany({
        where: {
          requestId: request.id,
          status: { in: [ProposalStatus.PENDING_TUTOR, ProposalStatus.TUTOR_ACCEPTED] },
        },
        data: { status: ProposalStatus.CANCELLED },
      });

      if (request.booking) {
        await tx.booking.updateMany({
          where: {
            id: request.booking.id,
            status: {
              in: [BookingStatus.PENDING, BookingStatus.ACCEPTED, BookingStatus.CONFIRMED],
            },
          },
          data: {
            status: BookingStatus.CANCELLED,
            cancellationReason: 'Solicitud StudyMatch cancelada',
            cancelledAt: new Date(),
          },
        });

        await tx.payment.updateMany({
          where: { bookingId: request.booking.id, status: PaymentStatus.APPROVED },
          data: { status: PaymentStatus.REFUNDED, refundedAt: new Date() },
        });
      }

      for (const slotId of slotIds) {
        await this.releaseSlotAfterProposal(tx, slotId);
      }
    });

    await this.notifications.createMany([
      ...activeProposalTutorIds.map((tutorId) => ({
        userId: tutorId,
        type: 'BOOKING_STATUS_CHANGED' as const,
        title: 'Solicitud urgente cancelada',
        message: 'El estudiante cancelo la solicitud StudyMatch.',
        data: { requestId: request.id },
      })),
      {
        userId: request.studentId,
        type: 'BOOKING_STATUS_CHANGED',
        title: 'Solicitud StudyMatch cancelada',
        message: 'Tu solicitud urgente fue cancelada.',
        data: { requestId: request.id },
      },
    ]);

    return {
      request: await this.getRequest(user, request.id),
      message: 'Solicitud StudyMatch cancelada.',
    };
  }

  async retryRequest(user: AuthenticatedUser, requestId: string) {
    const request = await this.prisma.tutoringRequest.findUnique({
      where: { id: requestId },
    });

    if (!request || (user.role !== Role.ADMIN && request.studentId !== user.id)) {
      throw new NotFoundException({
        code: 'STUDYMATCH_REQUEST_NOT_FOUND',
        message: 'La solicitud StudyMatch no existe',
      });
    }

    if (request.status !== TutoringRequestStatus.NO_TUTORS) {
      throw new ConflictException({
        code: 'INVALID_REQUEST_STATE',
        message: 'Solo puedes reintentar una solicitud sin tutores disponibles',
      });
    }

    await this.prisma.tutoringRequest.update({
      where: { id: request.id },
      data: { status: TutoringRequestStatus.SEARCHING },
    });

    return this.assignNextCandidate(request.id);
  }

  async advanceRequest(user: AuthenticatedUser, requestId: string) {
    const request = await this.prisma.tutoringRequest.findUnique({
      where: { id: requestId },
      include: { proposals: true },
    });

    if (!request || (user.role !== Role.ADMIN && request.studentId !== user.id)) {
      throw new NotFoundException({
        code: 'STUDYMATCH_REQUEST_NOT_FOUND',
        message: 'La solicitud StudyMatch no existe',
      });
    }

    if (
      [
        TutoringRequestStatus.CONFIRMED,
        TutoringRequestStatus.CANCELLED,
        TutoringRequestStatus.EXPIRED,
      ].some((status) => status === request.status)
    ) {
      throw new ConflictException({
        code: 'INVALID_REQUEST_STATE',
        message: `No se puede avanzar una solicitud en estado ${request.status}`,
      });
    }

    const activeProposal = request.proposals.find((proposal) =>
      [ProposalStatus.PENDING_TUTOR, ProposalStatus.TUTOR_ACCEPTED].some(
        (status) => status === proposal.status,
      ),
    );

    if (activeProposal) {
      await this.expireProposalById(activeProposal.id);
    }

    return this.assignNextCandidate(request.id);
  }

  async expireStaleProposals(): Promise<void> {
    if (this.expiring) {
      return;
    }

    this.expiring = true;

    try {
      const now = new Date();
      const stale = await this.prisma.studyMatchProposal.findMany({
        where: {
          status: { in: [ProposalStatus.PENDING_TUTOR, ProposalStatus.TUTOR_ACCEPTED] },
          expiresAt: { lte: now },
        },
        select: { id: true, requestId: true },
        orderBy: { expiresAt: 'asc' },
        take: 50,
      });

      const requestIds = [...new Set(stale.map((proposal) => proposal.requestId))];

      for (const requestId of requestIds) {
        const active = await this.prisma.studyMatchProposal.findFirst({
          where: {
            requestId,
            status: { in: [ProposalStatus.PENDING_TUTOR, ProposalStatus.TUTOR_ACCEPTED] },
            expiresAt: { lte: now },
          },
          orderBy: { expiresAt: 'asc' },
        });

        if (!active) {
          continue;
        }

        await this.expireProposalById(active.id);
        await this.assignNextCandidate(requestId);
      }
    } catch (error) {
      this.logger.error(
        `Error expirando propuestas StudyMatch: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      this.expiring = false;
    }
  }

  async assignNextCandidate(requestId: string) {
    const request = await this.prisma.tutoringRequest.findUnique({
      where: { id: requestId },
      include: {
        subject: true,
        professor: true,
        proposals: true,
      },
    });

    if (!request) {
      throw new NotFoundException({
        code: 'STUDYMATCH_REQUEST_NOT_FOUND',
        message: 'La solicitud StudyMatch no existe',
      });
    }

    if (
      [
        TutoringRequestStatus.CONFIRMED,
        TutoringRequestStatus.CANCELLED,
        TutoringRequestStatus.EXPIRED,
      ].some((status) => status === request.status)
    ) {
      return {
        request: await this.getRequestInternal(requestId, 'student'),
        proposal: null,
        alternatives: null,
        message: `La solicitud esta en estado ${request.status} y no admite nuevas propuestas.`,
      };
    }

    const now = new Date();
    const from = maxDate(now, request.availableFrom);
    const modalities = compatibleModalities(request.modality);
    const excludedTutorIds = request.proposals.map((proposal) => proposal.tutorId);

    const tutors = await this.prisma.tutorProfile.findMany({
      where: {
        verificationStatus: VerificationStatus.VERIFIED,
        isActive: true,
        user: { status: UserStatus.ACTIVE },
        ...(excludedTutorIds.length > 0 ? { userId: { notIn: excludedTutorIds } } : {}),
        subjects: {
          some: { subjectId: request.subjectId, status: VerificationStatus.VERIFIED },
        },
        availability: {
          some: {
            status: SlotStatus.AVAILABLE,
            startAt: { gte: from, lt: request.availableTo },
            endAt: { lte: request.availableTo },
            modality: { in: modalities },
          },
        },
      },
      include: {
        user: { select: { id: true, fullName: true } },
        professors: { select: { professorId: true } },
        availability: {
          where: {
            status: SlotStatus.AVAILABLE,
            startAt: { gte: from, lt: request.availableTo },
            endAt: { lte: request.availableTo },
            modality: { in: modalities },
          },
          orderBy: { startAt: 'asc' },
          take: 10,
        },
      },
    });

    if (tutors.length === 0) {
      return this.markNoTutors(request);
    }

    const workloadRows = await this.prisma.booking.groupBy({
      by: ['tutorId'],
      where: {
        tutorId: { in: tutors.map((tutor) => tutor.userId) },
        status: {
          in: [BookingStatus.PENDING, BookingStatus.ACCEPTED, BookingStatus.CONFIRMED],
        },
        startAt: { gt: now },
      },
      _count: { _all: true },
    });
    const workload = new Map(
      workloadRows.map((row) => [row.tutorId, row._count._all] as const),
    );
    const weights = this.config.getOrThrow<ScoringWeights>('studyMatch.weights');
    const scored: Array<{ tutor: (typeof tutors)[number]; result: ScoreResult }> = [];

    for (const tutor of tutors) {
      const candidate: ScoringCandidate = {
        tutorProfileId: tutor.id,
        userId: tutor.userId,
        averageRating: tutor.averageRating,
        reviewCount: tutor.reviewCount,
        professorIds: tutor.professors.map((professor) => professor.professorId),
        slots: tutor.availability,
        activeBookingsCount: workload.get(tutor.userId) ?? 0,
      };
      const result = this.scoring.score(
        candidate,
        {
          professorId: request.professorId,
          urgency: request.urgency,
          modality: request.modality,
          availableFrom: from,
          availableTo: request.availableTo,
          now,
        },
        weights,
      );

      if (result) {
        scored.push({ tutor, result });
      }
    }

    scored.sort((first, second) => {
      if (second.result.total !== first.result.total) {
        return second.result.total - first.result.total;
      }

      const timeDiff =
        first.result.bestSlot.startAt.getTime() - second.result.bestSlot.startAt.getTime();

      if (timeDiff !== 0) {
        return timeDiff;
      }

      return second.tutor.averageRating - first.tutor.averageRating;
    });

    for (const [index, candidate] of scored.entries()) {
      const expiresAt = addMinutes(now, this.ttlMinutes(request.urgency));

      try {
        const proposal = await this.prisma.$transaction(async (tx) => {
          const hold = await tx.availabilitySlot.updateMany({
            where: {
              id: candidate.result.bestSlot.id,
              status: SlotStatus.AVAILABLE,
              startAt: { gt: new Date() },
            },
            data: { status: SlotStatus.HELD, heldUntil: expiresAt },
          });

          if (hold.count === 0) {
            throw new SlotUnavailableError();
          }

          const created = await tx.studyMatchProposal.create({
            data: {
              requestId: request.id,
              tutorId: candidate.tutor.userId,
              slotId: candidate.result.bestSlot.id,
              score: candidate.result.total,
              scoreBreakdown: JSON.parse(
                JSON.stringify(candidate.result.breakdown),
              ) as Prisma.InputJsonValue,
              status: ProposalStatus.PENDING_TUTOR,
              rank: index + 1,
              expiresAt,
            },
            include: {
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
              slot: true,
            },
          });

          await tx.tutoringRequest.update({
            where: { id: request.id },
            data: { status: TutoringRequestStatus.PROPOSAL_SENT },
          });

          return created;
        });

        const tutorProfile = proposal.tutor.tutorProfile;
        const rate = tutorProfile ? money(tutorProfile.hourlyRate) : null;

        await this.notifications.createMany([
          {
            userId: proposal.tutorId,
            type: 'STUDYMATCH_PROPOSAL',
            title: 'Solicitud urgente compatible',
            message: `${request.subject.name}: ${request.topic} (${request.urgency}). Responde antes de ${formatDateTime(
              expiresAt,
            )}.`,
            data: {
              proposalId: proposal.id,
              requestId: request.id,
              urgency: request.urgency,
              modality: proposal.slot.modality,
              startAt: proposal.slot.startAt.toISOString(),
              endAt: proposal.slot.endAt.toISOString(),
              hourlyRate: rate,
              expiresAt: expiresAt.toISOString(),
            },
          },
          {
            userId: request.studentId,
            type: 'STUDYMATCH_PROPOSAL',
            title: 'Tutor compatible encontrado',
            message: `StudyMatch propuso a ${proposal.tutor.fullName}. Esperando respuesta del tutor.`,
            data: {
              proposalId: proposal.id,
              requestId: request.id,
              tutorName: proposal.tutor.fullName,
              expiresAt: expiresAt.toISOString(),
            },
          },
        ]);

        return {
          request: await this.getRequestInternal(request.id, 'student'),
          proposal: this.mapProposalForStudent(proposal),
          alternatives: null,
          message: 'Propuesta enviada al tutor. Tiene un tiempo limite para responder.',
        };
      } catch (error) {
        if (error instanceof SlotUnavailableError) {
          continue;
        }

        throw error;
      }
    }

    return this.markNoTutors(request);
  }

  private async markNoTutors(request: {
    id: string;
    studentId: string;
    subjectId: string;
    modality: Modality;
  }) {
    await this.prisma.tutoringRequest.update({
      where: { id: request.id },
      data: { status: TutoringRequestStatus.NO_TUTORS },
    });

    const alternatives = await this.findAlternatives(request);
    const mappedRequest = await this.getRequestInternal(request.id, 'student');

    await this.notifications.create({
      userId: request.studentId,
      type: 'STUDYMATCH_NO_TUTORS',
      title: 'Sin tutores disponibles',
      message:
        'No encontramos tutores elegibles en tu ventana de disponibilidad. Revisa los horarios alternativos o amplia tu busqueda.',
      data: {
        requestId: request.id,
        alternatives: alternatives.map((alternative) => ({
          tutorProfileId: alternative.tutorProfileId,
          startAt: alternative.startAt.toISOString(),
          endAt: alternative.endAt.toISOString(),
          modality: alternative.modality,
        })),
      },
    });

    return {
      request: mappedRequest,
      proposal: null,
      alternatives,
      message:
        'No hay tutores disponibles en la ventana indicada. Se proponen horarios alternativos.',
    };
  }

  private async findAlternatives(request: {
    subjectId: string;
    modality: Modality;
  }) {
    const now = new Date();
    const slots = await this.prisma.availabilitySlot.findMany({
      where: {
        status: SlotStatus.AVAILABLE,
        startAt: { gt: now, lte: addDays(now, 7) },
        modality: { in: compatibleModalities(request.modality) },
        tutor: {
          verificationStatus: VerificationStatus.VERIFIED,
          isActive: true,
          user: { status: UserStatus.ACTIVE },
          subjects: {
            some: {
              subjectId: request.subjectId,
              status: VerificationStatus.VERIFIED,
            },
          },
        },
      },
      orderBy: { startAt: 'asc' },
      take: 5,
      include: {
        tutor: {
          include: {
            user: { select: { fullName: true } },
          },
        },
      },
    });

    return slots.map((slot) => ({
      tutorProfileId: slot.tutor.id,
      tutorName: slot.tutor.user.fullName,
      averageRating: roundMoney(slot.tutor.averageRating),
      reviewCount: slot.tutor.reviewCount,
      hourlyRate: money(slot.tutor.hourlyRate),
      startAt: slot.startAt,
      endAt: slot.endAt,
      modality: slot.modality,
    }));
  }

  private async findRequestWithRelations(requestId: string) {
    const request = await this.prisma.tutoringRequest.findUnique({
      where: { id: requestId },
      include: {
        subject: true,
        professor: true,
        student: { select: { id: true, fullName: true, email: true } },
        proposals: {
          orderBy: { createdAt: 'desc' },
          include: {
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
            slot: true,
            booking: { select: { id: true, status: true } },
          },
        },
        booking: {
          include: {
            payments: { orderBy: { createdAt: 'desc' }, take: 1 },
          },
        },
      },
    });

    if (!request) {
      throw new NotFoundException({
        code: 'STUDYMATCH_REQUEST_NOT_FOUND',
        message: 'La solicitud StudyMatch no existe',
      });
    }

    return request;
  }

  private async getRequestInternal(
    requestId: string,
    view: 'student' | 'tutor' | 'admin',
    viewerId?: string,
  ) {
    const request = await this.findRequestWithRelations(requestId);
    return this.mapRequestForView(request, view, viewerId);
  }

  private async mapRequestForView(
    request: Awaited<ReturnType<StudyMatchService['findRequestWithRelations']>>,
    view: 'student' | 'tutor' | 'admin',
    viewerId?: string,
  ) {
    const proposals =
      view === 'tutor'
        ? request.proposals.filter((proposal) => proposal.tutorId === viewerId)
        : request.proposals;
    const alternatives =
      request.status === TutoringRequestStatus.NO_TUTORS
        ? await this.findAlternatives(request)
        : [];

    return {
      id: request.id,
      status: request.status,
      topic: request.topic,
      description: request.description,
      urgency: request.urgency,
      modality: request.modality,
      availableFrom: request.availableFrom,
      availableTo: request.availableTo,
      createdAt: request.createdAt,
      cancelledAt: request.cancelledAt,
      subject: request.subject,
      professor: request.professor,
      student:
        view === 'tutor'
          ? { alias: this.alias(request.studentId) }
          : view === 'admin'
            ? request.student
            : { id: request.studentId },
      proposals: proposals.map((proposal) =>
        view === 'tutor'
          ? this.mapProposalForTutor(proposal, request)
          : this.mapProposalForStudent(proposal),
      ),
      activeProposal:
        proposals.find((proposal) =>
          [ProposalStatus.PENDING_TUTOR, ProposalStatus.TUTOR_ACCEPTED].some(
            (status) => status === proposal.status,
          ),
        ) ?? null,
      booking: request.booking
        ? this.mapBookingSummary(request.booking, request.subject)
        : null,
      alternatives,
    };
  }

  private mapProposalForStudent(proposal: {
    id: string;
    requestId: string;
    status: ProposalStatus;
    rank: number;
    score: number;
    expiresAt: Date;
    respondedAt: Date | null;
    createdAt: Date;
    tutor: {
      id: string;
      fullName: string;
      tutorProfile: {
        id: string;
        averageRating: number;
        reviewCount: number;
        hourlyRate: Prisma.Decimal;
        modalities: Modality[];
      } | null;
    };
    slot: { id: string; startAt: Date; endAt: Date; modality: Modality };
  }) {
    const profile = proposal.tutor.tutorProfile;
    const durationMinutes = differenceInMinutes(proposal.slot.startAt, proposal.slot.endAt);
    const price = profile
      ? calculatePrice(
          money(profile.hourlyRate),
          durationMinutes,
          this.config.getOrThrow<number>('platformFeePercent'),
        )
      : null;

    return {
      id: proposal.id,
      requestId: proposal.requestId,
      status: proposal.status,
      rank: proposal.rank,
      score: roundMoney(proposal.score),
      expiresAt: proposal.expiresAt,
      respondedAt: proposal.respondedAt,
      createdAt: proposal.createdAt,
      tutor: {
        userId: proposal.tutor.id,
        profileId: profile?.id ?? null,
        fullName: proposal.tutor.fullName,
        averageRating: profile ? roundMoney(profile.averageRating) : null,
        reviewCount: profile?.reviewCount ?? null,
        hasReviews: (profile?.reviewCount ?? 0) > 0,
        hourlyRate: profile ? money(profile.hourlyRate) : null,
        modalities: profile?.modalities ?? [],
      },
      slot: {
        id: proposal.slot.id,
        startAt: proposal.slot.startAt,
        endAt: proposal.slot.endAt,
        modality: proposal.slot.modality,
      },
      estimatedPrice: price,
      awaitingTutor: proposal.status === ProposalStatus.PENDING_TUTOR,
      awaitingStudent: proposal.status === ProposalStatus.TUTOR_ACCEPTED,
    };
  }

  private mapProposalForTutor(
    proposal: {
      id: string;
      requestId: string;
      status: ProposalStatus;
      rank: number;
      score: number;
      expiresAt: Date;
      respondedAt: Date | null;
      createdAt: Date;
      slot: { id: string; startAt: Date; endAt: Date; modality: Modality };
    },
    request: {
      id: string;
      studentId: string;
      topic: string;
      description: string | null;
      urgency: Urgency;
      modality: Modality;
      availableFrom: Date;
      availableTo: Date;
      subject: { id: string; name: string; code: string };
      professor: { id: string; fullName: string } | null;
    },
  ) {
    const durationMinutes = differenceInMinutes(proposal.slot.startAt, proposal.slot.endAt);

    return {
      id: proposal.id,
      requestId: proposal.requestId,
      status: proposal.status,
      rank: proposal.rank,
      score: roundMoney(proposal.score),
      expiresAt: proposal.expiresAt,
      respondedAt: proposal.respondedAt,
      createdAt: proposal.createdAt,
      studentAlias: this.alias(request.studentId),
      request: {
        id: request.id,
        subject: request.subject,
        professor: request.professor,
        topic: request.topic,
        description: request.description,
        urgency: request.urgency,
        modality: request.modality,
        availableFrom: request.availableFrom,
        availableTo: request.availableTo,
      },
      slot: {
        id: proposal.slot.id,
        startAt: proposal.slot.startAt,
        endAt: proposal.slot.endAt,
        modality: proposal.slot.modality,
        durationMinutes,
      },
    };
  }

  private mapBookingSummary(
    booking: {
      id: string;
      status: BookingStatus;
      topic: string;
      modality: Modality;
      startAt: Date;
      endAt: Date;
      durationMinutes: number;
      hourlyRate: Prisma.Decimal;
      subtotal: Prisma.Decimal;
      platformFee: Prisma.Decimal;
      total: Prisma.Decimal;
      isEmergency: boolean;
      payments?: Array<{
        id: string;
        reference: string;
        status: PaymentStatus;
        amount: Prisma.Decimal;
        simulated: boolean;
        paidAt: Date | null;
      }>;
    },
    subject: { id: string; name: string; code: string },
  ) {
    const payment = booking.payments?.[0] ?? null;

    return {
      id: booking.id,
      status: booking.status,
      topic: booking.topic,
      modality: booking.modality,
      startAt: booking.startAt,
      endAt: booking.endAt,
      durationMinutes: booking.durationMinutes,
      subject,
      isEmergency: booking.isEmergency,
      price: {
        hourlyRate: money(booking.hourlyRate),
        subtotal: money(booking.subtotal),
        platformFee: money(booking.platformFee),
        total: money(booking.total),
        currency: 'COP',
        simulated: true,
      },
      payment: payment
        ? {
            id: payment.id,
            reference: payment.reference,
            status: payment.status,
            amount: money(payment.amount),
            simulated: payment.simulated,
            paidAt: payment.paidAt,
          }
        : null,
    };
  }

  private async expireProposalById(proposalId: string): Promise<string | null> {
    const proposal = await this.prisma.studyMatchProposal.findUnique({
      where: { id: proposalId },
      include: {
        request: { select: { id: true, studentId: true, subjectId: true, modality: true } },
        slot: true,
        booking: true,
      },
    });

    if (
      !proposal ||
      ![ProposalStatus.PENDING_TUTOR, ProposalStatus.TUTOR_ACCEPTED].some(
        (status) => status === proposal.status,
      )
    ) {
      return null;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.studyMatchProposal.updateMany({
        where: {
          id: proposal.id,
          status: { in: [ProposalStatus.PENDING_TUTOR, ProposalStatus.TUTOR_ACCEPTED] },
        },
        data: { status: ProposalStatus.EXPIRED },
      });

      if (proposal.booking && proposal.booking.status === BookingStatus.ACCEPTED) {
        await tx.booking.updateMany({
          where: { id: proposal.booking.id, status: BookingStatus.ACCEPTED },
          data: {
            status: BookingStatus.CANCELLED,
            cancellationReason: 'Tiempo de confirmacion del estudiante agotado',
            cancelledAt: new Date(),
          },
        });
      }

      await tx.tutoringRequest.updateMany({
        where: {
          id: proposal.requestId,
          status: {
            in: [
              TutoringRequestStatus.PROPOSAL_SENT,
              TutoringRequestStatus.AWAITING_STUDENT,
            ],
          },
        },
        data: { status: TutoringRequestStatus.SEARCHING },
      });

      await this.releaseSlotAfterProposal(tx, proposal.slotId);
    });

    await this.notifications.createMany([
      {
        userId: proposal.tutorId,
        type: 'STUDYMATCH_PROPOSAL_EXPIRED',
        title: 'Propuesta expirada',
        message:
          proposal.status === ProposalStatus.TUTOR_ACCEPTED
            ? 'El estudiante no confirmo la propuesta dentro del plazo.'
            : 'No respondiste la propuesta dentro del tiempo limite.',
        data: { proposalId: proposal.id, requestId: proposal.requestId },
      },
      {
        userId: proposal.request.studentId,
        type: 'STUDYMATCH_PROPOSAL_EXPIRED',
        title: 'Buscando otra alternativa',
        message: 'La propuesta expiro. StudyMatch continua con el siguiente tutor elegible.',
        data: { proposalId: proposal.id, requestId: proposal.requestId },
      },
    ]);

    return proposal.requestId;
  }

  private async releaseSlotAfterProposal(
    tx: Prisma.TransactionClient,
    slotId: string,
  ) {
    const activeBookings = await tx.booking.count({
      where: {
        slotId,
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
    const slot = await tx.availabilitySlot.findUnique({ where: { id: slotId } });

    if (activeBookings === 0 && activeProposals === 0 && slot) {
      await tx.availabilitySlot.update({
        where: { id: slotId },
        data: {
          status: slot.startAt > new Date() ? SlotStatus.AVAILABLE : SlotStatus.BLOCKED,
          heldUntil: null,
        },
      });
    }
  }

  private ttlMinutes(urgency: Urgency): number {
    const ttl = this.config.getOrThrow<Record<Urgency, number>>('studyMatch.ttlMinutes');
    return ttl[urgency];
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
