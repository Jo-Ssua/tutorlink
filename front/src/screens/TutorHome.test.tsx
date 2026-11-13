import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  EMPTY_PAGE,
  renderApp,
  sessionUser,
  stubApi,
  type StubbedRoute,
  waitForHeading,
  withStoredSession,
} from '../test/renderApp';
import type { StudyMatchTutorProposal } from '../studymatch/types';

const HOUR = 3_600_000;

function proposal(overrides: Partial<StudyMatchTutorProposal> = {}): StudyMatchTutorProposal {
  const startAt = new Date(Date.now() + 24 * HOUR);

  return {
    id: 'proposal-1',
    requestId: 'request-1',
    status: 'PENDING_TUTOR',
    rank: 1,
    score: 82,
    expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
    respondedAt: null,
    createdAt: new Date().toISOString(),
    studentAlias: 'Est-4821',
    request: {
      id: 'request-1',
      subject: { id: 'subject-1', code: 'SIS201', name: 'Estructuras de Datos' },
      professor: null,
      topic: 'Parcial de estructuras de datos',
      description: 'Repasar arboles AVL y grafos.',
      urgency: 'CRITICAL',
      modality: 'VIRTUAL',
      availableFrom: new Date().toISOString(),
      availableTo: new Date(Date.now() + 6 * HOUR).toISOString(),
    },
    slot: {
      id: 'slot-1',
      startAt: startAt.toISOString(),
      endAt: new Date(startAt.getTime() + HOUR).toISOString(),
      modality: 'VIRTUAL',
      durationMinutes: 60,
    },
    estimatedPrice: {
      hourlyRate: 45_000,
      durationMinutes: 60,
      subtotal: 45_000,
      platformFeePercent: 10,
      platformFee: 4_500,
      total: 49_500,
      currency: 'COP',
      simulated: true,
    },
    ...overrides,
  };
}

function stubTutorHome(pending: StudyMatchTutorProposal[], respond?: StubbedRoute) {
  return stubApi({
    '/auth/me': { data: sessionUser('TUTOR') },
    '/notifications/unread-count': { data: { unreadCount: 0 } },
    ...(respond ? { '/studymatch/proposals/proposal-1/respond': respond } : {}),
    '/bookings/tutor': { data: EMPTY_PAGE },
    '/studymatch/proposals/pending': { data: { items: pending, total: pending.length } },
  });
}

function writes(fetchMock: ReturnType<typeof stubTutorHome>['fetchMock']) {
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

describe('respuesta del tutor a solicitudes urgentes', () => {
  it('muestra materia, tema, horario, modalidad y tarifa de la solicitud', async () => {
    withStoredSession('TUTOR');
    stubTutorHome([proposal()]);

    renderApp('/app/tutor');
    await waitForHeading(/Hola, Ana/);

    expect(await screen.findByText(/Estructuras de Datos/)).toBeInTheDocument();
    expect(screen.getByText('Parcial de estructuras de datos')).toBeInTheDocument();
    expect(screen.getByText(/Est-4821/)).toBeInTheDocument();
    expect(screen.getByText('Virtual')).toBeInTheDocument();
    expect(screen.getByText(/45\.000\/hora/)).toBeInTheDocument();
    expect(screen.getByText(/49\.500/)).toBeInTheDocument();
    expect(screen.getByText(/Responde antes de/)).toBeInTheDocument();
  });

  it('aceptar responde la propuesta dentro del plazo', async () => {
    withStoredSession('TUTOR');
    const { fetchMock } = stubTutorHome([proposal()], {
      data: {
        proposal: proposal({ status: 'TUTOR_ACCEPTED' }),
        message: 'Propuesta aceptada.',
      },
    });
    const user = userEvent.setup();

    renderApp('/app/tutor');
    await waitForHeading(/Hola, Ana/);
    await user.click(await screen.findByRole('button', { name: 'Aceptar solicitud' }));

    await waitFor(() =>
      expect(
        writes(fetchMock).some(([url]) => url.includes('/studymatch/proposals/proposal-1/respond')),
      ).toBe(true),
    );
    const respondCall = writes(fetchMock).find(([url]) => url.includes('/respond'));
    expect(JSON.parse(String(respondCall?.[1]))).toEqual({ action: 'ACCEPT' });
  });

  it('rechazar responde con el motivo y libera la solicitud', async () => {
    withStoredSession('TUTOR');
    const { fetchMock } = stubTutorHome([proposal()], {
      data: {
        proposal: proposal({ status: 'TUTOR_REJECTED' }),
        message: 'Propuesta rechazada.',
      },
    });
    const user = userEvent.setup();

    renderApp('/app/tutor');
    await waitForHeading(/Hola, Ana/);
    await user.click(await screen.findByRole('button', { name: 'Rechazar y buscar otro tutor' }));

    await waitFor(() =>
      expect(writes(fetchMock).some(([url]) => url.includes('/respond'))).toBe(true),
    );
    const respondCall = writes(fetchMock).find(([url]) => url.includes('/respond'));
    expect(JSON.parse(String(respondCall?.[1]))).toEqual({
      action: 'REJECT',
      reason: 'No puedo atender esta solicitud.',
    });
  });

  it('si la API rechaza la respuesta muestra el motivo', async () => {
    withStoredSession('TUTOR');
    stubTutorHome([proposal()], {
      status: 409,
      error: {
        code: 'PROPOSAL_EXPIRED',
        message: 'La propuesta expiro y StudyMatch continua con el siguiente tutor elegible',
      },
    });
    const user = userEvent.setup();

    renderApp('/app/tutor');
    await waitForHeading(/Hola, Ana/);
    await user.click(await screen.findByRole('button', { name: 'Aceptar solicitud' }));

    expect(
      await screen.findByText(
        'La propuesta expiro y StudyMatch continua con el siguiente tutor elegible',
      ),
    ).toBeInTheDocument();
  });
});
