import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  renderApp,
  sessionUser,
  stubApi,
  type StubbedRoute,
  waitForHeading,
  withStoredSession,
} from '../test/renderApp';
import type { Booking } from '../types';

const booking = (overrides: Partial<Booking> = {}): Booking => ({
  id: 'booking-1',
  status: 'ACCEPTED',
  topic: 'Repaso de grafos',
  description: null,
  modality: 'VIRTUAL',
  startAt: '2026-12-01T15:00:00.000Z',
  endAt: '2026-12-01T16:00:00.000Z',
  durationMinutes: 60,
  isEmergency: false,
  requestId: null,
  proposalId: null,
  subject: { id: 'subject-1', name: 'Estructuras de Datos', code: 'SIS201' },
  student: { id: 'user-1' },
  tutor: {
    id: 'tutor-user-1',
    fullName: 'Ana Maria Torres',
    profileId: 'tutor-1',
    averageRating: 4.8,
    reviewCount: 12,
  },
  price: {
    hourlyRate: 45_000,
    durationMinutes: 60,
    subtotal: 45_000,
    platformFeePercent: 10,
    platformFee: 4_500,
    total: 49_500,
    currency: 'COP',
    simulated: true,
  },
  review: null,
  payment: null,
  cancellationReason: null,
  cancelledAt: null,
  completedAt: null,
  createdAt: '2026-11-10T15:00:00.000Z',
  ...overrides,
});

function page(items: Booking[]) {
  return {
    items,
    pagination: {
      page: 1,
      limit: 50,
      total: items.length,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    },
  };
}

function stubPayments(items: Booking[], payment?: StubbedRoute) {
  return stubApi({
    '/auth/me': { data: sessionUser('STUDENT') },
    '/notifications/unread-count': { data: { unreadCount: 0 } },
    ...(payment ? { '/payment': payment } : {}),
    '/bookings/my': { data: page(items) },
  });
}

const approvedPayment: StubbedRoute = {
  data: {
    booking: booking({
      status: 'CONFIRMED',
      payment: {
        id: 'payment-1',
        reference: 'SIM-1763000000000-ABCD1234',
        status: 'APPROVED',
        amount: 49_500,
        simulated: true,
        paidAt: '2026-11-13T15:00:00.000Z',
      },
    }),
    payment: {
      id: 'payment-1',
      reference: 'SIM-1763000000000-ABCD1234',
      status: 'APPROVED',
      amount: 49_500,
      simulated: true,
      paidAt: '2026-11-13T15:00:00.000Z',
    },
    disclaimer: 'Pago simulado aprobado para el MVP.',
  },
};

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe('pagos simulados del estudiante', () => {
  it('muestra tarifa, duración, comisión y total antes de confirmar', async () => {
    withStoredSession('STUDENT');
    stubPayments([booking()]);

    renderApp('/app/pagos');
    await waitForHeading(/Tarifas y pagos simulados/);

    expect(await screen.findByText('Estructuras de Datos')).toBeInTheDocument();
    expect(screen.getByText(/1 hora × .*45\.000 \/ hora/)).toBeInTheDocument();
    expect(screen.getByText('10% de comisión simulada')).toBeInTheDocument();
    expect(screen.getByText(/4\.500/)).toBeInTheDocument();
    expect(screen.getByText('Total a pagar')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Pagar .*49\.500/ })).toBeEnabled();
  });

  it('no pide ningún dato bancario', async () => {
    withStoredSession('STUDENT');
    stubPayments([booking()]);

    renderApp('/app/pagos');
    await waitForHeading(/Tarifas y pagos simulados/);
    await screen.findByText('Estructuras de Datos');

    expect(screen.queryByLabelText(/tarjeta|cuenta|banco|cvv/i)).not.toBeInTheDocument();
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
    expect(screen.getByText(/no se piden datos de tarjeta, cuenta ni banco/i)).toBeInTheDocument();
  });

  it('registra la transacción como pago simulado aprobado', async () => {
    withStoredSession('STUDENT');
    const { calls, fetchMock } = stubPayments([booking()], approvedPayment);

    renderApp('/app/pagos');
    await waitForHeading(/Tarifas y pagos simulados/);

    await userEvent.click(await screen.findByRole('button', { name: /Pagar .*49\.500/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar pago simulado' }));

    // El aviso de arriba y el estado de la ficha ya pagada lo dicen los dos.
    expect((await screen.findAllByText(/Pago simulado aprobado/)).length).toBeGreaterThan(1);
    expect(screen.getAllByText(/SIM-1763000000000-ABCD1234/).length).toBeGreaterThan(0);
    expect(calls.some((url) => url.includes('/bookings/booking-1/payment'))).toBe(true);

    const paymentCall = fetchMock.mock.calls.find((call) =>
      String(call[0]).includes('/payment'),
    ) as unknown as [RequestInfo | URL, RequestInit] | undefined;
    expect(JSON.parse(String(paymentCall?.[1].body))).toEqual({ simulatePayment: true });

    // La reserva pasa al grupo de pagos registrados.
    expect(screen.getByText('Pagos simulados registrados')).toBeInTheDocument();
    expect(screen.getByText('No tienes pagos pendientes')).toBeInTheDocument();
  });

  it('cancelar antes de confirmar no genera ningún cobro', async () => {
    withStoredSession('STUDENT');
    const { calls } = stubPayments([booking()], approvedPayment);

    renderApp('/app/pagos');
    await waitForHeading(/Tarifas y pagos simulados/);

    await userEvent.click(await screen.findByRole('button', { name: /Pagar .*49\.500/ }));
    expect(screen.getByText(/Si cancelas, la reserva sigue aceptada y sin ningún cobro/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(calls.some((url) => url.includes('/payment'))).toBe(false);
    expect(screen.getByRole('button', { name: /Pagar .*49\.500/ })).toBeInTheDocument();
  });

  it('muestra el error cuando el tutor todavía no acepta la solicitud', async () => {
    withStoredSession('STUDENT');
    stubPayments([booking()], {
      status: 409,
      error: {
        code: 'BOOKING_NOT_READY_FOR_PAYMENT',
        message: 'El tutor debe aceptar la solicitud antes de confirmar el pago simulado',
      },
    });

    renderApp('/app/pagos');
    await waitForHeading(/Tarifas y pagos simulados/);

    await userEvent.click(await screen.findByRole('button', { name: /Pagar .*49\.500/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar pago simulado' }));

    expect(
      await screen.findByText(
        'El tutor debe aceptar la solicitud antes de confirmar el pago simulado',
      ),
    ).toBeInTheDocument();
  });

  it('una solicitud sin aceptar se muestra sin cobro', async () => {
    withStoredSession('STUDENT');
    stubPayments([booking({ status: 'PENDING' })]);

    renderApp('/app/pagos');
    await waitForHeading(/Tarifas y pagos simulados/);

    expect(await screen.findByText('Esperando respuesta del tutor')).toBeInTheDocument();
    expect(screen.getByText(/Solicitud sin cobro/)).toBeInTheDocument();
    expect(screen.getByText('No tienes pagos pendientes')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Pagar/ })).not.toBeInTheDocument();
  });
});
