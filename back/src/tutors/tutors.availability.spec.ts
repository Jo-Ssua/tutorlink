import { ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Modality, Role, SlotStatus, VerificationStatus } from '@prisma/client';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { TutorsService } from './tutors.service';

const UUID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const HOUR = 3_600_000;

const tutorUser = { id: UUID(2), role: Role.TUTOR, fullName: 'Tutor' } as unknown as AuthenticatedUser;
const profile = { id: UUID(20), userId: UUID(2), verificationStatus: VerificationStatus.VERIFIED };

function build() {
  const prisma = {
    tutorProfile: {
      findFirst: jest.fn().mockResolvedValue({ id: profile.id }),
      findUnique: jest.fn().mockResolvedValue(profile),
    },
    availabilitySlot: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    booking: { count: jest.fn().mockResolvedValue(0) },
    studyMatchProposal: { count: jest.fn().mockResolvedValue(0) },
    $transaction: jest.fn((queries: Array<Promise<unknown>>) => Promise.all(queries)),
  };
  const config = { getOrThrow: jest.fn().mockReturnValue('salt') } as unknown as ConfigService;
  const service = new TutorsService(prisma as never, config, { createMany: jest.fn() } as never);
  return { service, prisma };
}

describe('Disponibilidad publica del tutor (SCRUM-20)', () => {
  it('solo consulta franjas futuras en estado AVAILABLE y calcula la duracion', async () => {
    const { service, prisma } = build();
    const start = new Date(Date.now() + 24 * HOUR);
    prisma.availabilitySlot.findMany.mockResolvedValue([
      {
        id: UUID(1),
        startAt: start,
        endAt: new Date(start.getTime() + 2 * HOUR),
        modality: Modality.HYBRID,
        status: SlotStatus.AVAILABLE,
        heldUntil: null,
      },
    ]);

    const result = await service.publicAvailability(profile.id, {});

    const where = prisma.availabilitySlot.findMany.mock.calls[0][0].where;
    expect(where.status).toBe(SlotStatus.AVAILABLE);
    expect(where.startAt.gt).toBeInstanceOf(Date);
    expect(result[0].durationMinutes).toBe(120);
  });

  it('responde 404 si el tutor no esta verificado o activo', async () => {
    const { service, prisma } = build();
    prisma.tutorProfile.findFirst.mockResolvedValue(null);

    await expect(service.publicAvailability(profile.id, {})).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('Agenda del tutor (SCRUM-20: cambios visibles para futuras reservas)', () => {
  const futureStart = () => new Date(Date.now() + 48 * HOUR).toISOString();
  const futureEnd = () => new Date(Date.now() + 49 * HOUR).toISOString();

  it('crea una nueva franja AVAILABLE', async () => {
    const { service, prisma } = build();
    prisma.availabilitySlot.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: UUID(5), heldUntil: null, ...data }),
    );

    const slot = await service.createAvailability(tutorUser, {
      startAt: futureStart(),
      endAt: futureEnd(),
      modality: Modality.VIRTUAL,
    });

    expect(slot.status).toBe(SlotStatus.AVAILABLE);
  });

  it('rechaza una franja que se cruza con otra', async () => {
    const { service, prisma } = build();
    prisma.availabilitySlot.findFirst.mockResolvedValue({ id: UUID(9) });

    await expect(
      service.createAvailability(tutorUser, {
        startAt: futureStart(),
        endAt: futureEnd(),
        modality: Modality.VIRTUAL,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('no permite modificar una franja con reservas asociadas (protege el historial)', async () => {
    const { service, prisma } = build();
    prisma.availabilitySlot.findUnique.mockResolvedValue({
      id: UUID(7),
      tutorId: profile.id,
      startAt: new Date(Date.now() + 10 * HOUR),
      endAt: new Date(Date.now() + 11 * HOUR),
      tutor: { userId: tutorUser.id },
    });
    prisma.booking.count.mockResolvedValue(1);

    await expect(
      service.updateAvailability(tutorUser, UUID(7), { modality: Modality.IN_PERSON }),
    ).rejects.toMatchObject({ response: { code: 'SLOT_HAS_HISTORY' } });
  });
});
