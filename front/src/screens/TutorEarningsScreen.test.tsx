import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  renderApp,
  sessionUser,
  stubApi,
  waitForHeading,
  withStoredSession,
} from '../test/renderApp';
import type { EarningsSummary } from '../types';

const summary = (): EarningsSummary => ({
  simulated: true,
  disclaimer:
    'Los ingresos mostrados son simulados para el MVP y no representan transferencias bancarias reales.',
  countingRule:
    'Solo suman los pagos simulados aprobados de sesiones completadas. Una reserva cancelada, reembolsada o que no se completó no entra en el total.',
  currency: 'COP',
  period: {
    from: '2026-11-01T00:00:00.000Z',
    to: '2026-11-16T00:00:00.000Z',
    groupBy: 'MONTH',
  },
  totals: {
    gross: 49_500,
    platformFees: 4_500,
    netEarnings: 45_000,
    sessions: 1,
    refundedTotal: 30_000,
    refundedSessions: 1,
  },
  periods: [
    {
      periodStart: '2026-11-01T00:00:00.000Z',
      gross: 49_500,
      platformFees: 4_500,
      netEarnings: 45_000,
      sessions: 1,
    },
  ],
  sessions: [
    {
      paymentId: 'pay-1',
      reference: 'SIM-1',
      bookingId: 'book-1',
      sessionDate: '2026-11-10T15:00:00.000Z',
      paidAt: '2026-11-10T15:00:00.000Z',
      subject: { id: 'subject-1', code: 'ISIS-1106', name: 'Cálculo 1' },
      studentAlias: 'Estudiante #AB12CD',
      durationMinutes: 60,
      subtotal: 45_000,
      platformFee: 4_500,
      total: 49_500,
      tutorEarnings: 45_000,
      status: 'APPROVED',
      simulated: true,
    },
  ],
  refunds: [
    {
      paymentId: 'pay-2',
      bookingId: 'book-2',
      sessionDate: '2026-11-11T15:00:00.000Z',
      refundedAt: '2026-11-12T15:00:00.000Z',
      subject: { id: 'subject-2', code: 'ISIS-1225', name: 'Estructuras de Datos' },
      bookingStatus: 'CANCELLED',
      amount: 30_000,
      tutorEarnings: 27_000,
      simulated: true,
      countsAsIncome: false,
    },
  ],
});

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe('resumen de ingresos simulados', () => {
  it('muestra el aviso, el total del período y el ingreso de cada sesión completada', async () => {
    withStoredSession('TUTOR');
    stubApi({
      '/auth/me': { data: sessionUser('TUTOR') },
      '/tutor/earnings': { data: summary() },
    });

    renderApp('/app/ingresos');
    await waitForHeading(/Resumen de ingresos/);

    expect(
      await screen.findByText(/no representan transferencias bancarias reales/),
    ).toBeInTheDocument();
    expect(screen.getByText(/no entra en el total/)).toBeInTheDocument();
    expect(screen.getAllByText(/45\.000/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Cálculo 1/)).toBeInTheDocument();
    expect(screen.getByText('Completada · suma')).toBeInTheDocument();
  });

  it('deja la reserva reembolsada fuera del ingreso', async () => {
    withStoredSession('TUTOR');
    stubApi({
      '/auth/me': { data: sessionUser('TUTOR') },
      '/tutor/earnings': { data: summary() },
    });

    renderApp('/app/ingresos');
    await waitForHeading(/Resumen de ingresos/);

    expect(await screen.findByText(/Estructuras de Datos/)).toBeInTheDocument();
    expect(screen.getByText('Reembolsada · no suma')).toBeInTheDocument();
    expect(screen.getByText(/no se incluyen/)).toBeInTheDocument();
  });
});
