import { ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingStatus, Modality, Role } from '@prisma/client';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { BookingsService } from './bookings.service';

const UUID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const HOUR = 3_600_000;
const tutor = {
  id: UUID(2),
  role: Role.TUTOR,
  fullName: 'Tutor',
} as unknown as AuthenticatedUser;

function bookingRow(overrides: Record<string, unknown> = {}) {
  const startAt = new Date(Date.now() + 24 * HOUR);
  return {
    id: UUID(30),
    studentId: UUID(1),
    tutorId: tutor.id,
    slotId: UUID(10),
    status: BookingStatus.PENDING,
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
    requestId: null,
    proposalId: null,
    cancellationReason: null,
    cancelledAt: null,
    completedAt: null,
    createdAt: new Date(),
    subject: { id: UUID(40), name: 'Estructuras', code: 'SIS201' },
    ...overrides,
  };
}

function build(
  row: Record<string, unknown> | null,
  updated = 1,
  finalRow: Record<string, unknown> | null = row,
) {
  const tx = {
    booking: {
      updateMany: jest.fn().mockResolvedValue({ count: updated }),
      findUniqueOrThrow: jest.fn().mockImplementation(() => Promise.resolve(finalRow)),
      count: jest.fn().mockResolvedValue(0),
    },
    studyMatchProposal: { count: jest.fn().mockResolvedValue(0) },
    availabilitySlot: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
  };
  const prisma = {
    booking: { findFirst: jest.fn().mockResolvedValue(row) },
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
  };
  const notifications = { create: jest.fn().mockResolvedValue(undefined) };
  const config = {
    getOrThrow: jest.fn().mockReturnValue('salt'),
  } as unknown as ConfigService;
  const service = new BookingsService(prisma as never, config, notifications as never);
  return { service, prisma, tx, notifications };
}

describe('Responder solicitudes de tutoria', () => {
  describe('aceptar', () => {
    it('pasa la reserva a ACCEPTED y avisa al estudiante', async () => {
      const row = bookingRow();
      const { service, tx, notifications } = build(row, 1, {
        ...row,
        status: BookingStatus.ACCEPTED,
      });

      const result = await service.accept(tutor, row.id);

      expect(tx.booking.updateMany).toHaveBeenCalledWith({
        where: { id: row.id, status: BookingStatus.PENDING },
        data: { status: BookingStatus.ACCEPTED },
      });
      expect(result.booking.status).toBe(BookingStatus.ACCEPTED);
      expect(notifications.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: row.studentId,
          type: 'BOOKING_STATUS_CHANGED',
          title: 'Solicitud aceptada',
          data: expect.objectContaining({
            bookingId: row.id,
            status: BookingStatus.ACCEPTED,
          }),
        }),
      );
    });

    it('solo responde reservas propias', async () => {
      const { service, notifications } = build(null);

      await expect(service.accept(tutor, UUID(99))).rejects.toBeInstanceOf(NotFoundException);
      expect(notifications.create).not.toHaveBeenCalled();
    });

    it('no acepta una solicitud que ya no esta pendiente', async () => {
      const { service, notifications } = build(bookingRow({ status: BookingStatus.REJECTED }));

      await expect(service.accept(tutor, UUID(30))).rejects.toMatchObject({
        response: { code: 'INVALID_BOOKING_STATE' },
      });
      expect(notifications.create).not.toHaveBeenCalled();
    });

    it('no acepta una solicitud cuya hora ya paso', async () => {
      const { service, tx } = build(bookingRow({ startAt: new Date(Date.now() - HOUR) }));

      await expect(service.accept(tutor, UUID(30))).rejects.toMatchObject({
        response: { code: 'BOOKING_EXPIRED' },
      });
      expect(tx.booking.updateMany).not.toHaveBeenCalled();
    });

    it('si otra respuesta ganó la carrera, falla sin avisar al estudiante', async () => {
      const { service, notifications } = build(bookingRow(), 0);

      await expect(service.accept(tutor, UUID(30))).rejects.toBeInstanceOf(ConflictException);
      expect(notifications.create).not.toHaveBeenCalled();
    });
  });

  describe('rechazar', () => {
    it('pasa a REJECTED con el motivo, libera la franja y avisa al estudiante', async () => {
      const row = bookingRow();
      const { service, tx, notifications } = build(row, 1, {
        ...row,
        status: BookingStatus.REJECTED,
        cancellationReason: 'No tengo disponibilidad',
      });

      const result = await service.reject(tutor, row.id, {
        reason: 'No tengo disponibilidad',
      });

      expect(tx.booking.updateMany).toHaveBeenCalledWith({
        where: { id: row.id, status: BookingStatus.PENDING },
        data: {
          status: BookingStatus.REJECTED,
          cancellationReason: 'No tengo disponibilidad',
        },
      });
      expect(tx.availabilitySlot.updateMany).toHaveBeenCalled();
      expect(result.booking.status).toBe(BookingStatus.REJECTED);
      expect(notifications.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: row.studentId,
          title: 'Solicitud rechazada',
          data: expect.objectContaining({
            status: BookingStatus.REJECTED,
            reason: 'No tengo disponibilidad',
          }),
        }),
      );
    });

    it('permite rechazar sin motivo', async () => {
      const row = bookingRow();
      const { service, notifications } = build(row, 1, {
        ...row,
        status: BookingStatus.REJECTED,
      });

      await service.reject(tutor, row.id, {});

      expect(notifications.create).toHaveBeenCalledTimes(1);
    });

    it('no rechaza una solicitud que ya fue aceptada', async () => {
      const { service, notifications } = build(bookingRow({ status: BookingStatus.ACCEPTED }));

      await expect(service.reject(tutor, UUID(30), {})).rejects.toBeInstanceOf(ConflictException);
      expect(notifications.create).not.toHaveBeenCalled();
    });

    it('si otra respuesta ganó la carrera, no avisa al estudiante', async () => {
      const { service, notifications } = build(bookingRow(), 0);

      await expect(service.reject(tutor, UUID(30), {})).rejects.toBeInstanceOf(ConflictException);
      expect(notifications.create).not.toHaveBeenCalled();
    });
  });
});
