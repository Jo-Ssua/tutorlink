import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingStatus, Role } from '@prisma/client';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { TutorHistoryQueryDto } from './dto/tutors.dto';
import { TutorHistoryService } from './tutor-history.service';

const UUID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const tutor = { id: UUID(2), role: Role.TUTOR } as unknown as AuthenticatedUser;
const subject = { id: UUID(9), code: 'MAT101', name: 'Calculo I' };

const review = {
  rating: 5,
  comment: 'Explica muy bien',
  isAnonymous: true,
  createdAt: new Date('2026-10-02T10:00:00Z'),
};

function booking(overrides: Record<string, unknown> = {}) {
  return {
    id: UUID(100),
    studentId: UUID(1),
    topic: 'Derivadas',
    description: 'Repaso',
    startAt: new Date('2026-10-01T14:00:00Z'),
    endAt: new Date('2026-10-01T15:00:00Z'),
    durationMinutes: 60,
    modality: 'VIRTUAL',
    status: BookingStatus.COMPLETED,
    hourlyRate: 30000,
    subtotal: 30000,
    platformFee: 3000,
    total: 33000,
    isEmergency: false,
    cancellationReason: null,
    cancelledAt: null,
    completedAt: new Date('2026-10-01T15:00:00Z'),
    createdAt: new Date('2026-09-30T10:00:00Z'),
    subject,
    review,
    payments: [],
    ...overrides,
  };
}

function build() {
  const prisma = {
    booking: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(0),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    review: {
      groupBy: jest.fn().mockResolvedValue([]),
      aggregate: jest.fn().mockResolvedValue({ _avg: { rating: null }, _count: { _all: 0 } }),
    },
    $transaction: jest.fn((queries: Array<Promise<unknown>>) => Promise.all(queries)),
  };
  const config = { getOrThrow: jest.fn().mockReturnValue('salt') } as unknown as ConfigService;
  return { service: new TutorHistoryService(prisma as never, config), prisma };
}

const query = (overrides: Partial<TutorHistoryQueryDto> = {}) =>
  ({ page: 1, limit: 20, ...overrides }) as TutorHistoryQueryDto;

describe('Historial de tutorias del tutor', () => {
  describe('listado (criterio 1)', () => {
    it('devuelve fecha, estudiante anonimizado, materia, estado y tarifa', async () => {
      const { service, prisma } = build();
      prisma.booking.findMany.mockResolvedValue([booking()]);
      prisma.booking.count.mockResolvedValue(1);

      const result = await service.list(tutor, query());
      const [item] = result.items;

      expect(item.startAt).toEqual(new Date('2026-10-01T14:00:00Z'));
      expect(item.studentAlias).toMatch(/^Estudiante #[0-9A-F]{6}$/);
      expect(item.subject).toEqual(subject);
      expect(item.status).toBe(BookingStatus.COMPLETED);
      expect(item.rate).toBe(30000);
      expect(item.total).toBe(33000);
      expect(item.durationMinutes).toBe(60);
      expect(JSON.stringify(result)).not.toContain(UUID(1));
      expect(result.pagination.total).toBe(1);
    });

    it('solo consulta las sesiones del tutor autenticado, de la mas reciente a la mas antigua', async () => {
      const { service, prisma } = build();

      await service.list(tutor, query());

      const args = prisma.booking.findMany.mock.calls[0][0];
      expect(args.where).toEqual({ tutorId: tutor.id });
      expect(args.orderBy).toEqual({ startAt: 'desc' });
    });
  });

  describe('detalle con resena (criterio 2)', () => {
    it('muestra la calificacion y el comentario de la sesion', async () => {
      const { service, prisma } = build();
      prisma.booking.findFirst.mockResolvedValue(booking());

      const result = await service.detail(tutor, UUID(100));

      expect(prisma.booking.findFirst.mock.calls[0][0].where).toEqual({
        id: UUID(100),
        tutorId: tutor.id,
      });
      expect(result.review).toMatchObject({ rating: 5, comment: 'Explica muy bien' });
      expect(result.tutorEarnings).toBe(30000);
      expect(result.platformFee).toBe(3000);
    });

    it('devuelve review nula cuando la sesion no tiene resena', async () => {
      const { service, prisma } = build();
      prisma.booking.findFirst.mockResolvedValue(booking({ review: null }));

      const result = await service.detail(tutor, UUID(100));

      expect(result.review).toBeNull();
    });

    it('no revela sesiones de otro tutor', async () => {
      const { service } = build();

      await expect(service.detail(tutor, UUID(100))).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('filtros (criterio 3)', () => {
    it('aplica fecha, materia y estado juntos', async () => {
      const { service, prisma } = build();

      await service.list(
        tutor,
        query({
          from: '2026-10-01T00:00:00.000Z',
          to: '2026-10-31T23:59:59.000Z',
          subjectId: subject.id,
          status: BookingStatus.COMPLETED,
        }),
      );

      expect(prisma.booking.findMany.mock.calls[0][0].where).toEqual({
        tutorId: tutor.id,
        status: BookingStatus.COMPLETED,
        subjectId: subject.id,
        startAt: {
          gte: new Date('2026-10-01T00:00:00.000Z'),
          lte: new Date('2026-10-31T23:59:59.000Z'),
        },
      });
    });

    it('incluye todo el dia final cuando `to` llega solo como fecha', async () => {
      const { service, prisma } = build();

      await service.list(tutor, query({ to: '2026-10-10' }));

      const { lte } = prisma.booking.findMany.mock.calls[0][0].where.startAt;
      expect(lte).toEqual(new Date('2026-10-10T23:59:59.999Z'));
    });

    it('rechaza un rango donde la fecha inicial es posterior a la final', async () => {
      const { service, prisma } = build();

      await expect(
        service.list(tutor, query({ from: '2026-11-01T00:00:00Z', to: '2026-10-01T00:00:00Z' })),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.booking.findMany).not.toHaveBeenCalled();
    });

    it('es de solo lectura: ninguna consulta escribe en la base', async () => {
      const { service, prisma } = build();
      prisma.booking.findFirst.mockResolvedValue(booking());
      const writers = prisma as unknown as Record<string, Record<string, unknown>>;

      await service.list(tutor, query({ status: BookingStatus.CANCELLED }));
      await service.detail(tutor, UUID(100));
      await service.summary(tutor);

      for (const model of ['booking', 'review']) {
        for (const method of ['create', 'update', 'updateMany', 'delete', 'deleteMany', 'upsert']) {
          expect(writers[model][method]).toBeUndefined();
        }
      }
    });
  });

  describe('resumen de trayectoria', () => {
    it('cuenta sesiones por estado y calcula promedio y distribucion', async () => {
      const { service, prisma } = build();
      prisma.booking.groupBy.mockResolvedValue([
        { status: BookingStatus.COMPLETED, _count: { _all: 4 } },
        { status: BookingStatus.CANCELLED, _count: { _all: 1 } },
      ]);
      prisma.review.groupBy.mockResolvedValue([
        { rating: 5, _count: { _all: 3 } },
        { rating: 4, _count: { _all: 1 } },
      ]);
      prisma.review.aggregate.mockResolvedValue({ _avg: { rating: 4.75 }, _count: { _all: 4 } });
      prisma.booking.findMany.mockResolvedValue([{ subject }]);
      prisma.booking.findFirst.mockResolvedValue({ startAt: new Date('2026-09-01T10:00:00Z') });

      const result = await service.summary(tutor);

      expect(result.totalSessions).toBe(5);
      expect(result.completedSessions).toBe(4);
      expect(result.sessionsByStatus.PENDING).toBe(0);
      expect(result.reviewCount).toBe(4);
      expect(result.averageRating).toBe(4.75);
      expect(result.ratingDistribution).toEqual({ '1': 0, '2': 0, '3': 0, '4': 1, '5': 3 });
      expect(result.subjects).toEqual([subject]);
      expect(result.firstSessionAt).toEqual(new Date('2026-09-01T10:00:00Z'));
    });

    it('con un tutor sin sesiones devuelve ceros, no errores', async () => {
      const { service } = build();

      const result = await service.summary(tutor);

      expect(result.totalSessions).toBe(0);
      expect(result.averageRating).toBe(0);
      expect(result.subjects).toEqual([]);
      expect(result.firstSessionAt).toBeNull();
    });
  });
});
