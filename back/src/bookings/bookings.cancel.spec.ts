import { ConfigService } from '@nestjs/config';
import { BookingStatus, Modality, PaymentStatus, Prisma, Role } from '@prisma/client';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { BookingsService } from './bookings.service';

const UUID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const HOUR = 3_600_000;

const student = {
  id: UUID(1),
  role: Role.STUDENT,
  fullName: 'Estudiante',
} as unknown as AuthenticatedUser;

function buildCancelService(
  overrides: {
    status?: BookingStatus;
    hoursUntilStart?: number;
    payments?: Array<{
      id: string;
      reference: string;
      status: PaymentStatus;
      amount: Prisma.Decimal;
      simulated: boolean;
      paidAt: Date | null;
    }>;
    requestId?: string | null;
  } = {},
) {
  const startAt = new Date(Date.now() + (overrides.hoursUntilStart ?? 48) * HOUR);
  const booking = {
    id: UUID(30),
    studentId: student.id,
    tutorId: UUID(2),
    slotId: UUID(10),
    status: overrides.status ?? BookingStatus.CONFIRMED,
    topic: 'Arboles AVL',
    description: null,
    modality: Modality.VIRTUAL,
    startAt,
    endAt: new Date(startAt.getTime() + HOUR),
    durationMinutes: 60,
    hourlyRate: 40_000,
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
    request: null,
    proposal: null,
    payments:
      overrides.payments ??
      [],
  };

  const cancelled = {
    ...booking,
    status: BookingStatus.CANCELLED,
    cancellationReason: 'Cambio de horario',
    cancelledAt: new Date(),
  };

  const tx = {
    payment: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    booking: {
      update: jest.fn().mockResolvedValue(cancelled),
      count: jest.fn().mockResolvedValue(0),
    },
    studyMatchProposal: { count: jest.fn().mockResolvedValue(0) },
    availabilitySlot: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    tutoringRequest: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
  };

  const prisma = {
    booking: { findUnique: jest.fn().mockResolvedValue(booking) },
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
  };

  const config = {
    getOrThrow: jest.fn((key: string) => {
      if (key === 'cancellationWindowHours') return 24;
      if (key === 'platformFeePercent') return 10;
      return 'salt';
    }),
  } as unknown as ConfigService;

  const notifications = { create: jest.fn().mockResolvedValue(undefined) };
  const service = new BookingsService(prisma as never, config, notifications as never);

  return { service, booking, cancelled, tx, prisma, notifications };
}

describe('BookingsService.cancel (SCRUM-23)', () => {
  it('cancela dentro del plazo, reembolsa el pago simulado y libera la franja', async () => {
    const { service, booking, tx, notifications } = buildCancelService({
      payments: [
        {
          id: UUID(70),
          reference: 'SIM-1763000000000-ABCD1234',
          status: PaymentStatus.APPROVED,
          amount: new Prisma.Decimal(44_000),
          simulated: true,
          paidAt: new Date(),
        },
      ],
    });

    const result = await service.cancel(student, booking.id, {
      reason: 'Cambio de horario',
    });

    expect(tx.payment.updateMany).toHaveBeenCalledWith({
      where: { bookingId: booking.id, status: PaymentStatus.APPROVED },
      data: expect.objectContaining({ status: PaymentStatus.REFUNDED }),
    });
    expect(tx.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: BookingStatus.CANCELLED,
          cancellationReason: 'Cambio de horario',
        }),
      }),
    );
    expect(tx.availabilitySlot.updateMany).toHaveBeenCalled();
    expect(result.booking.status).toBe(BookingStatus.CANCELLED);
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: UUID(2),
        title: 'Reserva cancelada',
        data: expect.objectContaining({
          bookingId: booking.id,
          simulatedRefund: true,
        }),
      }),
    );
  });

  it('fuera del plazo informa la restricción y conserva la reserva', async () => {
    const { service, booking, tx, notifications } = buildCancelService({
      hoursUntilStart: 2,
    });

    await expect(service.cancel(student, booking.id, {})).rejects.toMatchObject({
      response: {
        code: 'CANCELLATION_WINDOW_CLOSED',
        message: 'Solo puedes cancelar con al menos 24 horas de anticipacion',
      },
    });
    expect(tx.booking.update).not.toHaveBeenCalled();
    expect(tx.payment.updateMany).not.toHaveBeenCalled();
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it('no cancela una reserva ya cerrada', async () => {
    const { service, booking, tx } = buildCancelService({
      status: BookingStatus.COMPLETED,
    });

    await expect(service.cancel(student, booking.id, {})).rejects.toMatchObject({
      response: { code: 'INVALID_BOOKING_STATE' },
    });
    expect(tx.booking.update).not.toHaveBeenCalled();
  });
});
