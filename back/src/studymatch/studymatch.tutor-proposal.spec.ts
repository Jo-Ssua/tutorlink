import { ConfigService } from '@nestjs/config';
import { Modality, ProposalStatus, Role, Urgency } from '@prisma/client';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { StudyMatchService } from './studymatch.service';

const UUID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const HOUR = 3_600_000;

const tutorUser = {
  id: UUID(2),
  role: Role.TUTOR,
  fullName: 'Tutor',
} as unknown as AuthenticatedUser;

/** La tarifa llega como Decimal de Prisma: solo necesita `toNumber()`. */
const decimal = (value: number) => ({ toNumber: () => value });

const CONFIG: Record<string, unknown> = {
  platformFeePercent: 10,
  'security.anonymitySalt': 'salt',
};

function proposalRow(hourlyRate: number | null) {
  const startAt = new Date(Date.now() + 3 * HOUR);

  return {
    id: UUID(7),
    requestId: UUID(8),
    status: ProposalStatus.PENDING_TUTOR,
    rank: 1,
    score: 42.5,
    expiresAt: new Date(Date.now() + 15 * 60_000),
    respondedAt: null,
    createdAt: new Date(),
    slot: {
      id: UUID(9),
      startAt,
      // 90 minutos: la tarifa por hora no sirve tal cual, hay que prorratearla.
      endAt: new Date(startAt.getTime() + 1.5 * HOUR),
      modality: Modality.VIRTUAL,
    },
    tutor: {
      tutorProfile: hourlyRate === null ? null : { hourlyRate: decimal(hourlyRate) },
    },
    request: {
      id: UUID(8),
      studentId: UUID(3),
      topic: 'Derivadas implicitas',
      description: null,
      urgency: Urgency.CRITICAL,
      modality: Modality.VIRTUAL,
      availableFrom: new Date(),
      availableTo: new Date(Date.now() + 24 * HOUR),
      subject: { id: UUID(4), code: 'MAT101', name: 'Calculo I' },
      professor: { id: UUID(5), fullName: 'Ana Ruiz' },
    },
  };
}

function build() {
  const prisma = {
    studyMatchProposal: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const config = {
    getOrThrow: jest.fn((key: string) => CONFIG[key]),
  } as unknown as ConfigService;
  const service = new StudyMatchService(
    prisma as never,
    config,
    { create: jest.fn(), createMany: jest.fn() } as never,
    {} as never,
  );

  return { service, prisma };
}

describe('Propuesta urgente vista por el tutor (HU12: tarifa a la vista)', () => {
  it('entrega materia, tema, horario, modalidad y el desglose de la tarifa', async () => {
    const { service, prisma } = build();
    prisma.studyMatchProposal.findMany.mockResolvedValue([proposalRow(40_000)]);

    const { items } = await service.pendingProposals(tutorUser);

    expect(items).toHaveLength(1);
    const [proposal] = items;
    expect(proposal.request.subject.name).toBe('Calculo I');
    expect(proposal.request.topic).toBe('Derivadas implicitas');
    expect(proposal.slot.modality).toBe(Modality.VIRTUAL);
    expect(proposal.slot.durationMinutes).toBe(90);
    // 40.000/hora por 90 min = 60.000 de subtotal, 10 % de comision simulada.
    expect(proposal.estimatedPrice).toMatchObject({
      hourlyRate: 40_000,
      durationMinutes: 90,
      subtotal: 60_000,
      platformFeePercent: 10,
      platformFee: 6_000,
      total: 66_000,
      tutorEarnings: 60_000,
      currency: 'COP',
      simulated: true,
    });
  });

  it('pide la tarifa del tutor en la consulta, no la deduce del horario', async () => {
    const { service, prisma } = build();

    await service.pendingProposals(tutorUser);

    const include = prisma.studyMatchProposal.findMany.mock.calls[0][0].include;
    expect(include.tutor.select.tutorProfile.select.hourlyRate).toBe(true);
  });

  it('no inventa una tarifa cuando el perfil del tutor ya no existe', async () => {
    const { service, prisma } = build();
    prisma.studyMatchProposal.findMany.mockResolvedValue([proposalRow(null)]);

    const { items } = await service.pendingProposals(tutorUser);

    expect(items[0].estimatedPrice).toBeNull();
  });

  it('nunca expone la identidad del estudiante, solo su alias', async () => {
    const { service, prisma } = build();
    prisma.studyMatchProposal.findMany.mockResolvedValue([proposalRow(40_000)]);

    const { items } = await service.pendingProposals(tutorUser);

    expect(items[0].studentAlias).toMatch(/^Estudiante #[0-9A-F]{6}$/);
    expect(JSON.stringify(items[0])).not.toContain(UUID(3));
  });
});
