import { screen, waitFor } from '@testing-library/react';
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

const HOUR = 3_600_000;

function booking(overrides: Partial<Booking> = {}): Booking {
  const startAt = new Date(Date.now() + 48 * HOUR);
  const deadline = new Date(startAt.getTime() - 24 * HOUR);

  return {
    id: 'booking-1',
    status: 'CONFIRMED',
    topic: 'Repaso de grafos',
    description: null,
    modality: 'VIRTUAL',
    startAt: startAt.toISOString(),
    endAt: new Date(startAt.getTime() + HOUR).toISOString(),
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
    createdAt: new Date().toISOString(),
    cancellationPolicy: {
      windowHours: 24,
      canCancel: true,
      deadline: deadline.toISOString(),
      message: 'Puedes cancelar hasta 24 horas antes del inicio.',
    },
    ...overrides,
  };
}

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

function stubSessions(items: Booking[], cancel?: StubbedRoute) {
  return stubApi({
    '/auth/me': { data: sessionUser('STUDENT') },
    '/notifications/unread-count': { data: { unreadCount: 0 } },
    ...(cancel ? { '/bookings/booking-1/cancel': cancel } : {}),
    '/bookings/my': { data: page(items) },
  });
}

function writes(fetchMock: ReturnType<typeof stubSessions>['fetchMock']) {
  return (fetchMock.mock.calls as unknown as Array<[RequestInfo | URL, RequestInit?]>)
    .map(([input, init]) => [String(input), init?.body] as const)
    .filter(([, init]) => init !== undefined);
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe('mis sesiones del estudiante', () => {
  it('muestra fecha, tutor, materia, estado y tarifa', async () => {
    withStoredSession('STUDENT');
    stubSessions([booking()]);

    renderApp('/app/sesiones');
    await waitForHeading(/Mis sesiones/);

    expect(await screen.findByText(/Estructuras de Datos/)).toBeInTheDocument();
    expect(screen.getByText(/Ana Maria Torres/)).toBeInTheDocument();
    expect(screen.getByText('Repaso de grafos')).toBeInTheDocument();
    expect(screen.getByText('Confirmada')).toBeInTheDocument();
    expect(screen.getByText(/45\.000\/hora/)).toBeInTheDocument();
    expect(screen.getByText(/49\.500/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar reserva' })).toBeEnabled();
  });

  it('cancelar dentro del plazo cambia la reserva a cancelada', async () => {
    withStoredSession('STUDENT');
    const { fetchMock } = stubSessions([booking()], {
      data: {
        booking: booking({
          status: 'CANCELLED',
          cancellationReason: 'Cambio de horario',
          cancelledAt: new Date().toISOString(),
        }),
        message: 'Reserva cancelada. Si existia un pago simulado aprobado, fue marcado como reembolsado.',
      },
    });
    const user = userEvent.setup();

    renderApp('/app/sesiones');
    await waitForHeading(/Mis sesiones/);
    await user.click(await screen.findByRole('button', { name: 'Cancelar reserva' }));
    await user.type(screen.getByLabelText(/Motivo/), '  Cambio de horario  ');
    await user.click(screen.getByRole('button', { name: 'Confirmar cancelación' }));

    expect(await screen.findByText(/Reserva cancelada/)).toBeInTheDocument();
    expect(await screen.findByText('Cancelada')).toBeInTheDocument();
    expect(screen.queryByText('Confirmada')).not.toBeInTheDocument();

    const cancelCall = writes(fetchMock).find(([url]) => url.includes('/cancel'));
    expect(cancelCall?.[0]).toContain('/bookings/booking-1/cancel');
    expect(JSON.parse(String(cancelCall?.[1]))).toEqual({ reason: 'Cambio de horario' });
  });

  it('fuera del plazo informa la restricción y conserva la reserva', async () => {
    withStoredSession('STUDENT');
    const late = booking({
      cancellationPolicy: {
        windowHours: 24,
        canCancel: false,
        deadline: new Date(Date.now() - HOUR).toISOString(),
        message: 'La politica solo permite cancelar con al menos 24 horas de anticipacion.',
      },
    });
    stubSessions([late], {
      status: 409,
      error: {
        code: 'CANCELLATION_WINDOW_CLOSED',
        message: 'Solo puedes cancelar con al menos 24 horas de anticipacion',
      },
    });
    const user = userEvent.setup();

    renderApp('/app/sesiones');
    await waitForHeading(/Mis sesiones/);
    await user.click(await screen.findByRole('button', { name: 'Cancelar reserva' }));

    expect(
      screen.getByText(/esta reserva ya no se puede cancelar/i),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Confirmar cancelación' }));

    expect(
      await screen.findByText('Solo puedes cancelar con al menos 24 horas de anticipacion'),
    ).toBeInTheDocument();
    expect(screen.getByText('Confirmada')).toBeInTheDocument();
  });

  it('volver desde la confirmación no envía ninguna cancelación', async () => {
    withStoredSession('STUDENT');
    const { fetchMock } = stubSessions([booking()]);
    const user = userEvent.setup();

    renderApp('/app/sesiones');
    await waitForHeading(/Mis sesiones/);
    await user.click(await screen.findByRole('button', { name: 'Cancelar reserva' }));
    await user.click(screen.getByRole('button', { name: 'Volver' }));

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Confirmar cancelación' })).not.toBeInTheDocument(),
    );
    expect(writes(fetchMock)).toHaveLength(0);
  });

  it('sin reservas lo explica', async () => {
    withStoredSession('STUDENT');
    stubSessions([]);

    renderApp('/app/sesiones');

    expect(await screen.findByText('Todavía no tienes reservas')).toBeInTheDocument();
  });
});
