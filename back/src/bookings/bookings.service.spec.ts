import { BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Modality, Role } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/bookings.dto';

const UUID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const student = {
  id: UUID(1),
  role: Role.STUDENT,
  fullName: 'Estudiante',
} as unknown as AuthenticatedUser;

function buildService(slotModality: Modality, overlap: unknown = null) {
  const start = new Date(Date.now() + 48 * 3_600_000);
  const end = new Date(start.getTime() + 3_600_000);
  const slot = { id: UUID(10), startAt: start, endAt: end, modality: slotModality };
  const profile = {
    id: UUID(20),
    userId: UUID(2),
    hourlyRate: 40_000,
    user: { fullName: 'Tutor' },
  };

  const createdBooking = {
    id: UUID(30),
    studentId: student.id,
    tutorId: profile.userId,
    status: 'PENDING',
    startAt: start,
    endAt: end,
    modality: Modality.VIRTUAL,
    topic: 'Arboles AVL',
    description: null,
    durationMinutes: 60,
    hourlyRate: 40_000,
    subtotal: 40_000,
    platformFee: 4_000,
    total: 44_000,
    isEmergency: false,
    requestId: null,
    proposalId: null,
    cancellationReason: null,
    cancelledAt: null,
    completedAt: null,
    createdAt: new Date(),
    subject: { id: UUID(40), name: 'Estructuras', code: 'SIS201' },
  };

  const tx = {
    availabilitySlot: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    booking: { create: jest.fn().mockResolvedValue(createdBooking) },
  };

  const prisma = {
    tutorProfile: { findFirst: jest.fn().mockResolvedValue(profile) },
    availabilitySlot: { findFirst: jest.fn().mockResolvedValue(slot) },
    subject: {
      findUnique: jest.fn().mockResolvedValue({ id: UUID(40), name: 'Estructuras' }),
    },
    tutorSubject: { findFirst: jest.fn().mockResolvedValue({ id: UUID(50) }) },
    booking: { findFirst: jest.fn().mockResolvedValue(overlap) },
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
  };

  const config = {
    getOrThrow: jest.fn((key: string) => (key === 'platformFeePercent' ? 10 : 'salt')),
  } as unknown as ConfigService;
  const notifications = { createMany: jest.fn().mockResolvedValue(undefined) };

  const service = new BookingsService(prisma as never, config, notifications as never);
  return { service, tx, prisma, notifications, slot };
}

function dtoFor(slotId: string, modality: Modality) {
  return {
    tutorProfileId: UUID(20),
    slotId,
    subjectId: UUID(40),
    topic: 'Arboles AVL',
    modality,
  };
}

describe('BookingsService.create (SCRUM-21)', () => {
  it('crea la reserva en estado pendiente con la modalidad elegida', async () => {
    const { service, tx, notifications, slot } = buildService(Modality.HYBRID);

    const result = await service.create(student, dtoFor(slot.id, Modality.IN_PERSON));

    expect(result.booking.status).toBe('PENDING');
    expect(tx.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ modality: Modality.IN_PERSON, status: 'PENDING' }),
      }),
    );
    expect(tx.availabilitySlot.updateMany).toHaveBeenCalled();
    expect(notifications.createMany).toHaveBeenCalled();
  });

  it('rechaza una modalidad incompatible con la franja', async () => {
    const { service, slot } = buildService(Modality.VIRTUAL);

    await expect(
      service.create(student, dtoFor(slot.id, Modality.IN_PERSON)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza la reserva si la franja fue tomada por otro estudiante', async () => {
    const { service, tx, slot } = buildService(Modality.VIRTUAL);
    tx.availabilitySlot.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.create(student, dtoFor(slot.id, Modality.VIRTUAL)),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.booking.create).not.toHaveBeenCalled();
  });

  it('rechaza una reserva que se cruza con otra activa del estudiante', async () => {
    const { service, slot } = buildService(Modality.VIRTUAL, { id: UUID(99) });

    await expect(
      service.create(student, dtoFor(slot.id, Modality.VIRTUAL)),
    ).rejects.toMatchObject({ response: { code: 'STUDENT_BOOKING_OVERLAP' } });
  });
});

describe('CreateBookingDto', () => {
  it('identifica todos los campos obligatorios pendientes', async () => {
    const errors = await validate(plainToInstance(CreateBookingDto, {}));
    const fields = errors.map((error) => error.property).sort();

    expect(fields).toEqual(['modality', 'slotId', 'subjectId', 'topic', 'tutorProfileId']);
    errors.forEach((error) =>
      Object.values(error.constraints ?? {}).forEach((message) =>
        expect(message).toMatch(/^(Debes|El tema)/),
      ),
    );
  });

  it('acepta un cuerpo completo', async () => {
    const errors = await validate(
      plainToInstance(CreateBookingDto, dtoFor(UUID(10), Modality.VIRTUAL)),
    );
    expect(errors).toHaveLength(0);
  });
});
