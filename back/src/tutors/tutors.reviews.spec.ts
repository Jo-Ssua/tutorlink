import { NotFoundException } from '@nestjs/common';
import { BookingStatus, VerificationStatus } from '@prisma/client';
import { TutorsService } from './tutors.service';

const UUID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function buildService(options: { profile?: unknown; reviews?: unknown[]; total?: number } = {}) {
  const profile =
    options.profile === undefined ? { userId: UUID(2) } : options.profile;
  const reviews = options.reviews ?? [];

  const prisma = {
    tutorProfile: { findFirst: jest.fn().mockResolvedValue(profile) },
    review: {
      findMany: jest.fn().mockResolvedValue(reviews),
      count: jest.fn().mockResolvedValue(options.total ?? reviews.length),
    },
    $transaction: jest.fn((operations: Promise<unknown>[]) => Promise.all(operations)),
  };
  const config = { getOrThrow: jest.fn().mockReturnValue('salt') };
  const notifications = {};

  const service = new TutorsService(
    prisma as never,
    config as never,
    notifications as never,
  );
  return { service, prisma };
}

describe('TutorsService.publicReviews (SCRUM-18)', () => {
  it('consulta solo reseñas de sesiones completadas y las marca como verificadas', async () => {
    const { service, prisma } = buildService({
      reviews: [
        {
          id: UUID(60),
          rating: 5,
          comment: 'Muy clara',
          createdAt: new Date('2026-10-20T10:00:00.000Z'),
          studentId: UUID(1),
          booking: {
            status: BookingStatus.COMPLETED,
            subject: { name: 'Estructuras', code: 'SIS201' },
          },
        },
      ],
    });

    const result = await service.publicReviews(UUID(20), 1, 5);

    expect(prisma.review.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tutorId: UUID(2),
          booking: { status: BookingStatus.COMPLETED },
        },
      }),
    );
    expect(result.hasReviews).toBe(true);
    expect(result.message).toBeNull();
    expect(result.items[0]).toMatchObject({
      rating: 5,
      subject: 'Estructuras',
      subjectCode: 'SIS201',
      verifiedSession: true,
    });
    expect(result.items[0]).not.toHaveProperty('studentId');
    expect(result.items[0]).not.toHaveProperty('student');
  });

  it('informa cuando el tutor no tiene reseñas sin inventar metricas', async () => {
    const { service } = buildService({ reviews: [], total: 0 });

    const result = await service.publicReviews(UUID(20), 1, 5);

    expect(result.items).toEqual([]);
    expect(result.hasReviews).toBe(false);
    expect(result.message).toMatch(/no tiene resenas verificadas/i);
  });

  it('exige que el tutor este verificado y activo', async () => {
    const { service, prisma } = buildService({ profile: null });

    await expect(service.publicReviews(UUID(20), 1, 5)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.tutorProfile.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          verificationStatus: VerificationStatus.VERIFIED,
          isActive: true,
        }),
      }),
    );
  });
});
