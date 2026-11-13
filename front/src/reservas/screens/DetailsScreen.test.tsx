import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  renderApp,
  sessionUser,
  stubApi,
  type StubbedRoute,
  waitForHeading,
  withStoredSession,
} from '../../test/renderApp';

/** Una franja futura: `SlotsScreen` descarta lo que ya pasó. */
const START = new Date(Date.now() + 48 * 3_600_000);
const END = new Date(START.getTime() + 3_600_000);

const TUTOR_LIST = {
  items: [
    {
      id: 'tutor-1',
      fullName: 'Ana Maria Torres',
      hourlyRate: 45_000,
      averageRating: 4.8,
      reviewCount: 12,
      verificationStatus: 'VERIFIED',
      subjects: [{ id: 'subject-1', code: 'SIS201', name: 'Estructuras de Datos' }],
      nextAvailableAt: START.toISOString(),
      isAvailable: true,
    },
  ],
  pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
  suggestions: null,
};

const PROFILE = {
  id: 'tutor-1',
  fullName: 'Ana Maria Torres',
  bio: 'Monitora de algoritmos.',
  experienceYears: 3,
  hourlyRate: 45_000,
  modalities: ['VIRTUAL'],
  averageRating: 4.8,
  reviewCount: 12,
  hasReviews: true,
  verificationStatus: 'VERIFIED',
  completedSessions: 7,
  subjects: [
    {
      id: 'subject-1',
      code: 'SIS201',
      name: 'Estructuras de Datos',
      program: 'Ingeniería de Sistemas',
      faculty: 'Ingeniería',
      status: 'VERIFIED',
    },
  ],
  recentReviews: [],
  nextAvailability: [],
};

const AVAILABILITY = [
  {
    id: 'slot-1',
    startAt: START.toISOString(),
    endAt: END.toISOString(),
    modality: 'VIRTUAL',
    status: 'AVAILABLE',
  },
];

/** La cotización del servidor: subtotal más la comisión que el cliente no calcula. */
const QUOTE: StubbedRoute = {
  data: {
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
    disclaimer: 'El pago es simulado para el MVP.',
  },
};

/** El orden importa: `stubApi` empareja por subcadena y toma la primera clave. */
function stubFlow(quote: StubbedRoute = QUOTE) {
  return stubApi({
    '/auth/me': { data: sessionUser('STUDENT') },
    '/notifications/unread-count': { data: { unreadCount: 0 } },
    '/catalog': { data: [] },
    '/bookings/quote': quote,
    '/tutors/tutor-1/availability': { data: AVAILABILITY },
    '/tutors/tutor-1': { data: PROFILE },
    '/tutors': { data: TUTOR_LIST },
  });
}

/** Camino completo hasta el paso 2: tutores, perfil, horario y detalles. */
async function openDetails() {
  renderApp('/app/reservar');
  await waitForHeading(/Tutores disponibles/);

  await userEvent.click(
    await screen.findByRole('button', { name: 'Ver el perfil de Ana Maria Torres' }),
  );
  await waitForHeading(/Perfil del tutor/);

  await userEvent.click(screen.getByRole('button', { name: 'Ver horarios disponibles' }));
  await waitForHeading(/Selecciona tu horario/);

  // Hay dos grupos de radios: el filtro de modalidad y las horas del día.
  const hours = screen.getByRole('radiogroup', { name: 'Horas disponibles' });
  await userEvent.click(within(hours).getAllByRole('radio')[0]);
  await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  await waitForHeading(/Detalles de tu reserva/);
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe('resumen de costo antes de reservar', () => {
  it('muestra tarifa, duración, comisión y total con los valores del servidor', async () => {
    withStoredSession('STUDENT');
    stubFlow();

    await openDetails();

    expect(await screen.findByText('10% de comisión')).toBeInTheDocument();
    expect(screen.getByText(/4\.500/)).toBeInTheDocument();
    expect(screen.getByText(/1 hora × .*45\.000 \/ hora/)).toBeInTheDocument();
    // El total viene de la cotización: 45.000 de sesión más la comisión.
    expect(
      await screen.findByRole('button', { name: /Confirmar reserva · .*49\.500/ }),
    ).toBeEnabled();
  });

  it('bloquea la confirmación si la cotización falla, en vez de mostrar un total incompleto', async () => {
    withStoredSession('STUDENT');
    const { calls } = stubFlow({
      status: 500,
      error: { code: 'INTERNAL_ERROR', message: 'Fallo al cotizar' },
    });

    await openDetails();

    expect(await screen.findByText(/No pudimos calcular el valor de la sesión/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmar reserva' })).toBeDisabled();
    // Nada de un total calculado en el cliente, que se quedaría sin comisión.
    expect(screen.queryByText(/45\.000 COP/)).not.toBeInTheDocument();

    const before = calls.filter((url) => url.includes('/bookings/quote')).length;
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(calls.filter((url) => url.includes('/bookings/quote')).length).toBeGreaterThan(before);
  });

  it('cancelar antes de confirmar deja el flujo sin reserva ni cobro', async () => {
    withStoredSession('STUDENT');
    const { calls } = stubFlow();

    await openDetails();

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(
      screen.getByText(/no se crea ninguna reserva y no se registra ningún cobro/),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Salir sin reservar' }));
    await waitForHeading(/Tutores disponibles/);

    // Solo la cotización, nunca el POST que crea la reserva.
    const bookingPosts = calls.filter(
      (url) => url.includes('/bookings') && !url.includes('/bookings/quote'),
    );
    expect(bookingPosts).toHaveLength(0);
  });

  it('seguir con la reserva vuelve al formulario sin perder el total', async () => {
    withStoredSession('STUDENT');
    stubFlow();

    await openDetails();

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Seguir con la reserva' }));

    expect(
      screen.getByRole('button', { name: /Confirmar reserva · .*49\.500/ }),
    ).toBeInTheDocument();
  });
});
