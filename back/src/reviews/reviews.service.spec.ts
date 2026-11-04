import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, Role } from '@prisma/client';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { ReviewsService } from './reviews.service';

const UUID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const student = {
  id: UUID(1),
  role: Role.STUDENT,
  fullName: 'Estudiante',
} as unknown as AuthenticatedUser;

const dto = { rating: 5, comment: 'Explico con claridad' };

function buildService(options: {
  status?: BookingStatus;
  studentId?: string;
  hasReview?: boolean;
  average?: number | null;
  count?: number;
} = {}) {
  const booking = {
    id: UUID(30),
    studentId: options.studentId ?? student.id,
    tutorId: UUID(2),
    status: options.status ?? BookingStatus.COMPLETED,
    subject: { id: UUID(40), name: 'Estructuras', code: 'SIS201' },
    review: options.hasReview ? { id: UUID(50) } : null,
  };

  const createdReview = {
    id: UUID(60),
    bookingId: booking.id,
    rating: dto.rating,
    comment: dto.comment,
    isAnonymous: true,
    createdAt: new Date(),
  };

  const tx = {
    review: {
      create: jest.fn().mockResolvedValue(createdReview),
      aggregate: jest.fn().mockResolvedValue({
        _avg: { rating: options.average ?? 4.5 },
        _count: { _all: options.count ?? 2 },
      }),
    },
    tutorProfile: { update: jest.fn().mockResolvedValue({}) },
  };

  const prisma = {
    booking: { findUnique: jest.fn().mockResolvedValue(booking) },
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
  };
  const notifications = { create: jest.fn().mockResolvedValue(undefined) };

  const service = new ReviewsService(prisma as never, notifications as never);
  return { service, prisma, tx, notifications, booking };
}

describe('ReviewsService.create (SCRUM-17)', () => {
  it('registra una calificacion entre 1 y 5 y actualiza el promedio del tutor', async () => {
    const { service, tx, notifications } = buildService({ average: 4.5, count: 2 });

    const result = await service.create(student, UUID(30), dto);

    expect(tx.review.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ rating: 5, studentId: student.id }),
      }),
    );
    expect(tx.tutorProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { averageRating: 4.5, reviewCount: 2 },
      }),
    );
    expect(result.tutorRating).toEqual({ averageRating: 4.5, reviewCount: 2 });
    expect(notifications.create).toHaveBeenCalled();
  });

  it('bloquea la calificacion cuando la reserva no esta completada', async () => {
    const { service, tx } = buildService({ status: BookingStatus.CONFIRMED });

    await expect(service.create(student, UUID(30), dto)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(tx.review.create).not.toHaveBeenCalled();
  });

  it('evita reseñas duplicadas para la misma sesion', async () => {
    const { service, tx } = buildService({ hasReview: true });

    await expect(service.create(student, UUID(30), dto)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(tx.review.create).not.toHaveBeenCalled();
  });

  it('no permite calificar una reserva de otro estudiante', async () => {
    const { service } = buildService({ studentId: UUID(99) });

    await expect(service.create(student, UUID(30), dto)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
