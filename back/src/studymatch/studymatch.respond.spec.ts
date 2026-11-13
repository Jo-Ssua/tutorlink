import { ConfigService } from '@nestjs/config';
import {
  BookingStatus,
  Modality,
  ProposalStatus,
  Role,
  TutoringRequestStatus,
  Urgency,
  VerificationStatus,
} from '@prisma/client';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { ProposalResponseAction } from './dto/studymatch.dto';
import { StudyMatchService } from './studymatch.service';

const UUID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const HOUR = 3_600_000;

const tutor = {
  id: UUID(2),
  role: Role.TUTOR,
  fullName: 'Ana Torres',
} as unknown as AuthenticatedUser;

function buildProposal(overrides: { expiresAt?: Date; status?: ProposalStatus } = {}) {
  const startAt = new Date(Date.now() + 24 * HOUR);
  return {
    id: UUID(30),
    requestId: UUID(40),
    tutorId: tutor.id,
    slotId: UUID(10),
    score: 82,
    expiresAt: overrides.expiresAt ?? new Date(Date.now() + 5 * 60_000),
    status: overrides.status ?? ProposalStatus.PENDING_TUTOR,
    respondedAt: null,
    rejectionReason: null,
    createdAt: new Date(),
    request: {
      id: UUID(40),
      studentId: UUID(1),
      subjectId: UUID(50),
      topic: 'Parcial de estructuras de datos',
      description: 'Repasar arboles AVL y grafos.',
      urgency: Urgency.CRITICAL,
      modality: Modality.VIRTUAL,
      availableFrom: new Date(),
      availableTo: new Date(Date.now() + 6 * HOUR),
      status: TutoringRequestStatus.PROPOSAL_SENT,
      subject: { id: UUID(50), name: 'Estructuras de Datos', code: 'SIS201' },
      professor: null,
      student: { id: UUID(1) },
    },
    slot: {
      id: UUID(10),
      startAt,
      endAt: new Date(startAt.getTime() + HOUR),
      modality: Modality.VIRTUAL,
      status: 'HELD',
    },
    booking: null,
    tutor: {
      id: tutor.id,
      fullName: tutor.fullName,
      tutorProfile: {
        id: UUID(60),
        averageRating: 4.8,
        reviewCount: 12,
        hourlyRate: 45_000,
        modalities: [Modality.VIRTUAL],
        verificationStatus: VerificationStatus.VERIFIED,
        isActive: true,
      },
    },
  };
}

function buildService(proposal: ReturnType<typeof buildProposal>) {
  const confirmedBooking = {
    id: UUID(70),
    studentId: proposal.request.studentId,
    tutorId: tutor.id,
    status: BookingStatus.ACCEPTED,
    topic: proposal.request.topic,
    modality: proposal.slot.modality,
    startAt: proposal.slot.startAt,
    endAt: proposal.slot.endAt,
    durationMinutes: 60,
    hourlyRate: 45_000,
    subtotal: 45_000,
    platformFee: 4_500,
    total: 49_500,
    isEmergency: true,
    payments: [],
  };

  const updated = {
    ...proposal,
    status: ProposalStatus.TUTOR_REJECTED,
    respondedAt: new Date(),
  };

  const tx = {
    studyMatchProposal: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: jest.fn().mockResolvedValue(updated),
      count: jest.fn().mockResolvedValue(0),
    },
    availabilitySlot: {
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUnique: jest.fn().mockResolvedValue({ id: proposal.slotId, startAt: proposal.slot.startAt }),
    },
    booking: {
      create: jest.fn().mockResolvedValue(confirmedBooking),
      count: jest.fn().mockResolvedValue(0),
    },
    tutoringRequest: { update: jest.fn().mockResolvedValue({}), updateMany: jest.fn() },
  };

  const prisma = {
    studyMatchProposal: {
      findUnique: jest.fn().mockResolvedValue(proposal),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
  };

  const config = {
    getOrThrow: jest.fn((key: string) => {
      if (key === 'platformFeePercent') return 10;
      if (key === 'studyMatch.studentConfirmMinutes') return 10;
      if (key === 'security.anonymitySalt') return 'salt';
      return 10;
    }),
  } as unknown as ConfigService;

  const notifications = {
    create: jest.fn().mockResolvedValue(undefined),
    createMany: jest.fn().mockResolvedValue({ count: 2 }),
  };

  const service = new StudyMatchService(
    prisma as never,
    config,
    notifications as never,
    {} as never,
  );

  return { service, prisma, tx, notifications, confirmedBooking, updated };
}

describe('StudyMatchService.respondProposal (SCRUM-27)', () => {
  it('aceptar dentro del plazo crea la reserva y avisa al estudiante', async () => {
    const proposal = buildProposal();
    const { service, tx, notifications } = buildService(proposal);

    const accepted = {
      ...proposal,
      status: ProposalStatus.TUTOR_ACCEPTED,
      respondedAt: new Date(),
      booking: { id: UUID(70) },
    };
    tx.studyMatchProposal.findUniqueOrThrow.mockResolvedValue(accepted);

    const result = await service.respondProposal(tutor, proposal.id, {
      action: ProposalResponseAction.ACCEPT,
    });

    expect(tx.studyMatchProposal.updateMany).toHaveBeenCalledWith({
      where: {
        id: proposal.id,
        status: ProposalStatus.PENDING_TUTOR,
        expiresAt: { gt: expect.any(Date) },
      },
      data: expect.objectContaining({
        status: ProposalStatus.TUTOR_ACCEPTED,
      }),
    });
    expect(tx.booking.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        studentId: proposal.request.studentId,
        tutorId: tutor.id,
        requestId: proposal.requestId,
        proposalId: proposal.id,
        status: BookingStatus.ACCEPTED,
        isEmergency: true,
        modality: proposal.slot.modality,
      }),
    });
    expect(tx.tutoringRequest.update).toHaveBeenCalledWith({
      where: { id: proposal.requestId },
      data: { status: TutoringRequestStatus.AWAITING_STUDENT },
    });
    expect(result.booking?.status).toBe(BookingStatus.ACCEPTED);
    expect(result.message).toMatch(/confirmar condiciones y pago simulado/i);

    const studentNotice = notifications.createMany.mock.calls[0][0].find(
      (notice: { type: string }) => notice.type === 'STUDYMATCH_PROPOSAL_ACCEPTED',
    );
    expect(studentNotice).toMatchObject({
      userId: proposal.request.studentId,
      data: expect.objectContaining({
        modality: proposal.slot.modality,
        hourlyRate: 45_000,
        total: 49_500,
        bookingId: UUID(70),
      }),
    });
  });

  it('rechazar avisa al estudiante y continua con el siguiente tutor', async () => {
    const proposal = buildProposal();
    const { service, tx, notifications } = buildService(proposal);
    const next = jest
      .spyOn(service, 'assignNextCandidate')
      .mockResolvedValue({ proposal: null, alternatives: [], message: 'next' } as never);

    const result = await service.respondProposal(tutor, proposal.id, {
      action: ProposalResponseAction.REJECT,
      reason: 'No tengo disponibilidad',
    });

    expect(tx.studyMatchProposal.updateMany).toHaveBeenCalledWith({
      where: { id: proposal.id, status: ProposalStatus.PENDING_TUTOR },
      data: {
        status: ProposalStatus.TUTOR_REJECTED,
        respondedAt: expect.any(Date),
        rejectionReason: 'No tengo disponibilidad',
      },
    });
    expect(tx.tutoringRequest.updateMany).toHaveBeenCalledWith({
      where: {
        id: proposal.requestId,
        status: {
          in: [TutoringRequestStatus.PROPOSAL_SENT, TutoringRequestStatus.AWAITING_STUDENT],
        },
      },
      data: { status: TutoringRequestStatus.SEARCHING },
    });
    expect(next).toHaveBeenCalledWith(proposal.requestId);
    expect(result.message).toMatch(/siguiente tutor elegible/i);
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: proposal.request.studentId,
        type: 'STUDYMATCH_PROPOSAL_REJECTED',
      }),
    );
  });

  it('sin respuesta a tiempo expira la propuesta y busca otro tutor', async () => {
    const proposal = buildProposal({ expiresAt: new Date(Date.now() - 60_000) });
    const { service } = buildService(proposal);
    const expire = jest
      .spyOn(service as never as Record<string, jest.Mock>, 'expireProposalById')
      .mockResolvedValue(proposal.requestId);
    const next = jest
      .spyOn(service, 'assignNextCandidate')
      .mockResolvedValue({ proposal: null, alternatives: [], message: 'next' } as never);

    await expect(
      service.respondProposal(tutor, proposal.id, {
        action: ProposalResponseAction.ACCEPT,
      }),
    ).rejects.toMatchObject({ response: { code: 'PROPOSAL_EXPIRED' } });

    expect(expire).toHaveBeenCalledWith(proposal.id);
    expect(next).toHaveBeenCalledWith(proposal.requestId);
  });
});

describe('StudyMatchService.expireStaleProposals (SCRUM-27)', () => {
  it('expira las propuestas vencidas y pasa al siguiente candidato', async () => {
    const proposal = buildProposal({ expiresAt: new Date(Date.now() - 60_000) });
    const { service, prisma } = buildService(proposal);
    prisma.studyMatchProposal.findMany.mockResolvedValue([
      { id: proposal.id, requestId: proposal.requestId },
    ]);
    prisma.studyMatchProposal.findFirst.mockResolvedValue({
      id: proposal.id,
      requestId: proposal.requestId,
    });

    const expire = jest
      .spyOn(service as never as Record<string, jest.Mock>, 'expireProposalById')
      .mockResolvedValue(proposal.requestId);
    const next = jest
      .spyOn(service, 'assignNextCandidate')
      .mockResolvedValue({ proposal: null, alternatives: [], message: 'next' } as never);

    await service.expireStaleProposals();

    expect(expire).toHaveBeenCalledWith(proposal.id);
    expect(next).toHaveBeenCalledWith(proposal.requestId);
  });
});
