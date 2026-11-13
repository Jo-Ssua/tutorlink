import { ConfigService } from '@nestjs/config';
import { BookingStatus, Role } from '@prisma/client';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { TutorRequestsService } from './tutor-requests.service';

const UUID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const HOUR = 3_600_000;
const tutor = { id: UUID(2), role: Role.TUTOR } as unknown as AuthenticatedUser;
const subject = { id: UUID(9), code: 'MAT101', name: 'Calculo I' };

function row(status: BookingStatus, hoursFromNow = 24, overrides: Record<string, unknown> = {}) {
  const startAt = new Date(Date.now() + hoursFromNow * HOUR);
  return {
    id: UUID(100),
    studentId: UUID(1),
    topic: 'Derivadas',
    description: 'Repaso para el parcial',
    startAt,
    endAt: new Date(startAt.getTime() + HOUR),
    durationMinutes: 60,
    modality: 'VIRTUAL',
    status,
    hourlyRate: 30_000,
    subtotal: 30_000,
    total: 33_000,
    isEmergency: false,
    cancellationReason: null,
    createdAt: new Date(),
    subject,
    ...overrides,
  };
}

function build() {
  const prisma = {
    booking: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
  };
  const config = {
    getOrThrow: jest.fn().mockReturnValue('salt'),
  } as unknown as ConfigService;
  return { service: new TutorRequestsService(prisma as never, config), prisma };
}

describe('Panel de solicitudes del tutor', () => {
  it('agrupa pendientes, aceptadas, rechazadas y proximas sesiones, con sus totales', async () => {
    const { service, prisma } = build();
    prisma.booking.findMany
      .mockResolvedValueOnce([row(BookingStatus.PENDING)])
      .mockResolvedValueOnce([row(BookingStatus.ACCEPTED)])
      .mockResolvedValueOnce([row(BookingStatus.REJECTED, 24, { cancellationReason: 'Sin cupo' })])
      .mockResolvedValueOnce([row(BookingStatus.CONFIRMED)]);
    prisma.booking.count
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(4);

    const result = await service.dashboard(tutor);

    expect(result.counts).toEqual({
      pending: 3,
      accepted: 2,
      rejected: 1,
      upcoming: 4,
    });
    expect(result.pending[0].status).toBe(BookingStatus.PENDING);
    expect(result.accepted[0].status).toBe(BookingStatus.ACCEPTED);
    expect(result.rejected[0].cancellationReason).toBe('Sin cupo');
    expect(result.upcoming[0].status).toBe(BookingStatus.CONFIRMED);
  });

  it('cada solicitud trae materia, tema, fecha, modalidad y tarifa, con el estudiante anonimizado', async () => {
    const { service, prisma } = build();
    prisma.booking.findMany.mockResolvedValueOnce([row(BookingStatus.PENDING)]);

    const [item] = (await service.dashboard(tutor)).pending;

    expect(item.subject).toEqual(subject);
    expect(item.topic).toBe('Derivadas');
    expect(item.startAt).toBeInstanceOf(Date);
    expect(item.modality).toBe('VIRTUAL');
    expect(item.rate).toBe(30_000);
    expect(item.total).toBe(33_000);
    expect(item.studentAlias).toMatch(/^Estudiante #[0-9A-F]{6}$/);
    expect(JSON.stringify(item)).not.toContain(UUID(1));
  });

  it('solo consulta las reservas del tutor autenticado y las proximas son futuras y confirmadas', async () => {
    const { service, prisma } = build();

    await service.dashboard(tutor);

    for (const [args] of prisma.booking.findMany.mock.calls) {
      expect(args.where.tutorId).toBe(tutor.id);
    }
    const upcoming = prisma.booking.findMany.mock.calls[3][0].where;
    expect(upcoming.status).toBe(BookingStatus.CONFIRMED);
    expect(upcoming.startAt.gt).toBeInstanceOf(Date);
  });

  it('marca como no respondible una solicitud pendiente cuya hora ya paso', async () => {
    const { service, prisma } = build();
    prisma.booking.findMany.mockResolvedValueOnce([
      row(BookingStatus.PENDING, 5),
      row(BookingStatus.PENDING, -5),
    ]);

    const { pending } = await service.dashboard(tutor);

    expect(pending[0].canRespond).toBe(true);
    expect(pending[1].canRespond).toBe(false);
  });

  it('sin solicitudes devuelve bloques vacios y ceros', async () => {
    const { service } = build();

    const result = await service.dashboard(tutor);

    expect(result.counts).toEqual({
      pending: 0,
      accepted: 0,
      rejected: 0,
      upcoming: 0,
    });
    expect(result.pending).toEqual([]);
  });
});
