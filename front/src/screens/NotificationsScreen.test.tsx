import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  renderApp,
  sessionUser,
  stubApi,
  waitForHeading,
  withStoredSession,
} from '../test/renderApp';

const proposalNotification = {
  id: 'notification-1',
  type: 'STUDYMATCH_PROPOSAL',
  title: 'Solicitud urgente compatible',
  message: 'Estructuras de Datos: Parcial · Virtual · $ 45.000/hora.',
  data: {
    proposalId: 'proposal-1',
    requestId: 'request-1',
    subject: 'Estructuras de Datos',
    topic: 'Parcial de estructuras de datos',
    urgency: 'CRITICAL',
    modality: 'VIRTUAL',
    startAt: '2026-12-01T15:00:00.000Z',
    endAt: '2026-12-01T16:00:00.000Z',
    hourlyRate: 45_000,
    expiresAt: '2026-11-13T18:00:00.000Z',
  },
  readAt: null,
  createdAt: '2026-11-13T17:50:00.000Z',
};

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe('notificación de solicitud urgente', () => {
  it('muestra materia, tema, horario, modalidad y tarifa al tutor', async () => {
    withStoredSession('TUTOR');
    stubApi({
      '/auth/me': { data: sessionUser('TUTOR') },
      '/notifications/unread-count': { data: { unreadCount: 1 } },
      '/notifications': {
        data: {
          items: [proposalNotification],
          pagination: {
            page: 1,
            limit: 30,
            total: 1,
            totalPages: 1,
            hasNextPage: false,
            hasPreviousPage: false,
          },
        },
      },
    });

    renderApp('/app/notificaciones');
    await waitForHeading('Notificaciones');

    expect(await screen.findByText('Solicitud urgente compatible')).toBeInTheDocument();
    expect(screen.getAllByText('Estructuras de Datos').length).toBeGreaterThan(0);
    expect(screen.getByText('Parcial de estructuras de datos')).toBeInTheDocument();
    expect(screen.getByText('Virtual')).toBeInTheDocument();
    expect(screen.getAllByText(/45\.000\/hora/).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Responder solicitud urgente' })).toHaveAttribute(
      'href',
      '/app/tutor',
    );
  });
});
