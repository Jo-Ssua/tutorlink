import { ConfigService } from '@nestjs/config';
import { BookingStatus, Role } from '@prisma/client';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { EarningsGroupBy } from './dto/tutors.dto';
import { TutorsService } from './tutors.service';

const tutorUser = { id: 'tutor-user', role: Role.TUTOR } as AuthenticatedUser;

describe('Ingresos simulados del tutor (SCRUM-33)', () => {
  it('suma solo el pago aprobado de una sesion completada y deja el reembolso fuera del total', async () => {
    const paidAt = new Date('2026-11-10T15:00:00.000Z');
    const approved = {
      id: 'pay-1',
      reference: 'SIM-1',
      bookingId: 'book-1',
      studentId: 'student-1',
      amount: 49_500,
      platformFee: 4_500,
      tutorEarnings: 45_000,
      status: 'APPROVED',
      simulated: true,
      paidAt,
      createdAt: paidAt,
      booking: {
        startAt: paidAt,
        durationMinutes: 60,
        subtotal: 45_000,
        status: BookingStatus.COMPLETED,
        subject: { id: 'subject-1', code: 'ISIS-1106', name: 'Cálculo 1' },
      },
    };
    const refundedAt = new Date('2026-11-12T15:00:00.000Z');
    const refunded = {
      id: 'pay-2',
      bookingId: 'book-2',
      studentId: 'student-2',
      amount: 30_000,
      tutorEarnings: 27_000,
      refundedAt,
      booking: {
        startAt: new Date('2026-11-11T15:00:00.000Z'),
        status: BookingStatus.CANCELLED,
        subject: { id: 'subject-2', code: 'ISIS-1225', name: 'Estructuras de Datos' },
      },
    };
    const prisma = {
      payment: {
        findMany: jest.fn((args: { where: { status: string; booking?: { status: string } } }) =>
          Promise.resolve(args.where.status === 'APPROVED' ? [approved] : [refunded]),
        ),
      },
    };
    const config = { getOrThrow: jest.fn().mockReturnValue('salt') } as unknown as ConfigService;
    const service = new TutorsService(prisma as never, config, { createMany: jest.fn() } as never);

    const result = await service.earnings(tutorUser, { groupBy: EarningsGroupBy.MONTH });

    const approvedQuery = prisma.payment.findMany.mock.calls.find(
      (call) => call[0].where.status === 'APPROVED',
    );
    expect(approvedQuery?.[0].where.booking).toEqual({ status: BookingStatus.COMPLETED });
    expect(result.simulated).toBe(true);
    expect(result.disclaimer).toMatch(/no representan transferencias bancarias reales/);
    expect(result.totals.netEarnings).toBe(45_000);
    expect(result.totals.sessions).toBe(1);
    expect(result.sessions).toHaveLength(1);
    expect(result.sessions[0].tutorEarnings).toBe(45_000);
    expect(result.refunds).toHaveLength(1);
    expect(result.refunds[0].countsAsIncome).toBe(false);
    expect(result.refunds[0].bookingStatus).toBe(BookingStatus.CANCELLED);
    expect(result.totals.refundedTotal).toBe(30_000);
    expect(result.periods).toHaveLength(1);
    expect(result.periods[0].netEarnings).toBe(45_000);
  });
});
