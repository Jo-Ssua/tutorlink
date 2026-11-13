import { BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingStatus, Modality, PaymentStatus, Role } from '@prisma/client';
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

function buildService(
  slotModality: Modality,
  overlap: unknown = null,
  durationMinutes = 60,
) {
  const start = new Date(Date.now() + 48 * 3_600_000);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
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

const PAYMENT_BOOKING_ID = UUID(60);

interface PaymentBookingOverrides {
  status?: BookingStatus;
  requestId?: string | null;
  payments?: unknown[];
}

/**
 * Doble para el pago simulado: la reserva ya existe y el tutor la acepto, asi
 * que solo hacen falta la consulta, la transaccion y las notificaciones.
 */
function buildPaymentService(overrides: PaymentBookingOverrides = {}) {
  const start = new Date(Date.now() + 48 * 3_600_000);
  const end = new Date(start.getTime() + 3_600_000);

  const booking = {
    id: PAYMENT_BOOKING_ID,
    studentId: student.id,
    tutorId: UUID(2),
    topic: 'Arboles AVL',
    description: null,
    modality: Modality.VIRTUAL,
    startAt: start,
    endAt: end,
    status: overrides.status ?? BookingStatus.ACCEPTED,
    hourlyRate: 40_000,
    durationMinutes: 60,
    subtotal: 40_000,
    platformFee: 4_000,
    total: 44_000,
    isEmergency: false,
    requestId: overrides.requestId ?? null,
    proposalId: null,
    cancellationReason: null,
    cancelledAt: null,
    completedAt: null,
    createdAt: new Date(),
    subject: { id: UUID(40), name: 'Estructuras', code: 'SIS201' },
    payments: overrides.payments ?? [],
  };

  const createdPayment = {
    id: UUID(70),
    reference: 'SIM-1763000000000-ABCD1234',
    status: PaymentStatus.APPROVED,
    amount: 44_000,
    simulated: true,
    paidAt: new Date(),
  };

  const tx = {
    payment: { create: jest.fn().mockResolvedValue(createdPayment) },
    booking: {
      update: jest.fn().mockResolvedValue({
        ...booking,
        status: BookingStatus.CONFIRMED,
        payments: [createdPayment],
      }),
    },
  };

  const prisma = {
    booking: { findFirst: jest.fn().mockResolvedValue(booking) },
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
  };

  const config = {
    getOrThrow: jest.fn((key: string) => (key === 'platformFeePercent' ? 10 : 'salt')),
  } as unknown as ConfigService;
  const notifications = { createMany: jest.fn().mockResolvedValue(undefined) };

  const service = new BookingsService(prisma as never, config, notifications as never);
  return { service, prisma, tx, notifications, createdPayment };
}

describe('BookingsService.quote', () => {
  it('desglosa tarifa, duracion, comision simulada y total', async () => {
    const { service, slot } = buildService(Modality.VIRTUAL);

    const result = await service.quote({ tutorProfileId: UUID(20), slotId: slot.id });

    expect(result.price).toMatchObject({
      hourlyRate: 40_000,
      durationMinutes: 60,
      subtotal: 40_000,
      platformFeePercent: 10,
      platformFee: 4_000,
      total: 44_000,
      currency: 'COP',
      simulated: true,
    });
    expect(result.disclaimer).toMatch(/no se solicitan ni procesan datos bancarios reales/i);
  });

  it('cobra la duracion real de la franja, no una hora fija', async () => {
    const { service, slot } = buildService(Modality.VIRTUAL, null, 90);

    const result = await service.quote({ tutorProfileId: UUID(20), slotId: slot.id });

    expect(result.price).toMatchObject({
      durationMinutes: 90,
      subtotal: 60_000,
      platformFee: 6_000,
      total: 66_000,
    });
  });

  it('no cotiza una franja que ya no esta disponible', async () => {
    const { service, prisma } = buildService(Modality.VIRTUAL);
    prisma.availabilitySlot.findFirst.mockResolvedValue(null);

    await expect(
      service.quote({ tutorProfileId: UUID(20), slotId: UUID(10) }),
    ).rejects.toMatchObject({ response: { code: 'SLOT_NOT_AVAILABLE' } });
  });
});

describe('BookingsService.confirmPayment', () => {
  const confirm = { simulatePayment: true };

  it('registra la transaccion como pago simulado aprobado y confirma la reserva', async () => {
    const { service, tx, notifications } = buildPaymentService();

    const result = await service.confirmPayment(student, PAYMENT_BOOKING_ID, confirm);

    expect(tx.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: PaymentStatus.APPROVED,
          type: 'SIMULATED',
          simulated: true,
          currency: 'COP',
          amount: 44_000,
          platformFee: 4_000,
          tutorEarnings: 40_000,
        }),
      }),
    );
    expect(tx.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: BookingStatus.CONFIRMED } }),
    );
    expect(result.payment.status).toBe(PaymentStatus.APPROVED);
    expect(result.payment.simulated).toBe(true);
    expect(result.payment.reference).toMatch(/^SIM-/);
    expect(result.booking.status).toBe(BookingStatus.CONFIRMED);
    expect(result.disclaimer).toMatch(/no se realizo ningun cobro/i);

    const notified = notifications.createMany.mock.calls[0][0] as Array<{
      userId: string;
      type: string;
    }>;
    expect(notified.map((item) => item.type)).toEqual(['PAYMENT_SIMULATED', 'PAYMENT_SIMULATED']);
    expect(notified.map((item) => item.userId)).toEqual([UUID(2), student.id]);
  });

  it('expone el porcentaje de comision guardado en la reserva', async () => {
    const { service } = buildPaymentService();

    const result = await service.confirmPayment(student, PAYMENT_BOOKING_ID, confirm);

    expect(result.booking.price).toMatchObject({
      hourlyRate: 40_000,
      durationMinutes: 60,
      subtotal: 40_000,
      platformFeePercent: 10,
      platformFee: 4_000,
      total: 44_000,
      simulated: true,
    });
  });

  it('no cobra nada si el estudiante no confirma el pago simulado', async () => {
    const { service, prisma, tx } = buildPaymentService();

    await expect(
      service.confirmPayment(student, PAYMENT_BOOKING_ID, { simulatePayment: false }),
    ).rejects.toMatchObject({ response: { code: 'SIMULATED_PAYMENT_REQUIRED' } });
    expect(prisma.booking.findFirst).not.toHaveBeenCalled();
    expect(tx.payment.create).not.toHaveBeenCalled();
  });

  it('exige que el tutor haya aceptado la solicitud', async () => {
    const { service, tx } = buildPaymentService({ status: BookingStatus.PENDING });

    await expect(
      service.confirmPayment(student, PAYMENT_BOOKING_ID, confirm),
    ).rejects.toMatchObject({ response: { code: 'BOOKING_NOT_READY_FOR_PAYMENT' } });
    expect(tx.payment.create).not.toHaveBeenCalled();
  });

  it('no aprueba dos pagos para la misma reserva', async () => {
    const { service, tx } = buildPaymentService({ status: BookingStatus.CONFIRMED });

    await expect(
      service.confirmPayment(student, PAYMENT_BOOKING_ID, confirm),
    ).rejects.toMatchObject({ response: { code: 'PAYMENT_ALREADY_CONFIRMED' } });
    expect(tx.payment.create).not.toHaveBeenCalled();
  });

  it('manda las reservas de StudyMatch a su propia confirmacion', async () => {
    const { service, tx } = buildPaymentService({ requestId: UUID(80) });

    await expect(
      service.confirmPayment(student, PAYMENT_BOOKING_ID, confirm),
    ).rejects.toMatchObject({ response: { code: 'USE_STUDYMATCH_CONFIRMATION' } });
    expect(tx.payment.create).not.toHaveBeenCalled();
  });

  it('no cobra una reserva que no existe', async () => {
    const { service, prisma, tx } = buildPaymentService();
    prisma.booking.findFirst.mockResolvedValue(null);

    await expect(
      service.confirmPayment(student, PAYMENT_BOOKING_ID, confirm),
    ).rejects.toMatchObject({ response: { code: 'BOOKING_NOT_FOUND' } });
    expect(tx.payment.create).not.toHaveBeenCalled();
  });
});
