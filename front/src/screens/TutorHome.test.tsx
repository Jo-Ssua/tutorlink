import { screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderApp, sessionUser, stubApi, withStoredSession, EMPTY_PAGE } from '../test/renderApp';
import type { StudyMatchTutorProposal } from '../studymatch/types';

const SUBJECT = { id: 'subject-1', code: 'MAT-101', name: 'Cálculo I' };

const proposal: StudyMatchTutorProposal = {
  id: 'proposal-1',
  requestId: 'request-1',
  status: 'PENDING_TUTOR',
  rank: 1,
  score: 42.5,
  expiresAt: '2026-12-01T13:45:00.000Z',
  respondedAt: null,
  createdAt: '2026-12-01T13:30:00.000Z',
  studentAlias: 'Estudiante #A1B2C3',
  estimatedPrice: {
    hourlyRate: 40_000,
    durationMinutes: 90,
    subtotal: 60_000,
    platformFeePercent: 10,
    platformFee: 6_000,
    total: 66_000,
    tutorEarnings: 60_000,
    currency: 'COP',
    simulated: true,
  },
  request: {
    id: 'request-1',
    subject: SUBJECT,
    professor: { id: 'professor-1', fullName: 'Ana Ruiz' },
    topic: 'Derivadas implícitas',
    description: 'Parcial mañana',
    urgency: 'CRITICAL',
    modality: 'VIRTUAL',
    availableFrom: '2026-12-01T14:00:00.000Z',
    availableTo: '2026-12-02T14:00:00.000Z',
  },
  slot: {
    id: 'slot-1',
    startAt: '2026-12-01T14:00:00.000Z',
    endAt: '2026-12-01T15:30:00.000Z',
    modality: 'VIRTUAL',
    durationMinutes: 90,
  },
};

function stubHome(proposals: StudyMatchTutorProposal[]) {
  return stubApi({
    '/auth/me': { data: sessionUser('TUTOR') },
    '/bookings/tutor': { data: EMPTY_PAGE },
    '/studymatch/proposals/pending': { data: { items: proposals, total: proposals.length } },
  });
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe('propuestas urgentes en el inicio del tutor', () => {
  it('muestra materia, tema, horario, modalidad y tarifa antes de responder', async () => {
    withStoredSession('TUTOR');
    stubHome([proposal]);

    renderApp('/app/tutor');

    expect(await screen.findByText('MAT-101 · Cálculo I')).toBeInTheDocument();
    expect(screen.getByText('Derivadas implícitas')).toBeInTheDocument();

    // La tarifa es parte de la decisión, no un dato que aparezca después de aceptar.
    const rate = screen.getByText('Tarifa').closest('div') as HTMLElement;
    expect(within(rate).getByText(/40\.000/)).toBeInTheDocument();
    expect(within(rate).getByText(/hora/)).toBeInTheDocument();

    const earnings = screen.getByText('Recibes').closest('div') as HTMLElement;
    expect(within(earnings).getByText(/60\.000/)).toBeInTheDocument();
    expect(within(earnings).getByText(/66\.000/)).toBeInTheDocument();
    expect(within(earnings).getByText(/10%/)).toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Aceptar solicitud' })).toBeInTheDocument();
  });

  it('sin tarifa registrada lo dice en vez de mostrar un cero', async () => {
    withStoredSession('TUTOR');
    stubHome([{ ...proposal, estimatedPrice: null }]);

    renderApp('/app/tutor');

    expect(await screen.findByText('Sin tarifa registrada')).toBeInTheDocument();
    expect(screen.queryByText('Recibes')).not.toBeInTheDocument();
  });
});
