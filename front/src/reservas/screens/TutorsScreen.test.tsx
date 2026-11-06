import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  renderApp,
  sessionUser,
  stubApi,
  waitForHeading,
  withStoredSession,
} from '../../test/renderApp';

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
      nextAvailableAt: '2026-11-07T15:00:00.000Z',
      isAvailable: true,
    },
  ],
  pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
};

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe('búsqueda de tutores', () => {
  it('pide el orden por relevancia mientras no se filtre nada', async () => {
    withStoredSession('STUDENT');
    const { calls } = stubApi({
      '/auth/me': { data: sessionUser('STUDENT') },
      '/tutors': { data: TUTOR_LIST },
    });

    renderApp('/app/reservar');
    await waitForHeading(/Tutores disponibles/);

    const query = calls.find((url) => url.includes('/tutors?'));
    expect(query).toContain('sortBy=RELEVANCE');
    // «Cualquiera» y «Todas» son ausencia de filtro, no un valor que viaje.
    expect(query).not.toContain('minRating');
    expect(query).not.toContain('modality');
  });

  it('manda el texto buscado a la API al aplicar los filtros', async () => {
    withStoredSession('STUDENT');
    const { calls } = stubApi({
      '/auth/me': { data: sessionUser('STUDENT') },
      '/tutors': { data: TUTOR_LIST },
    });

    renderApp('/app/reservar');
    await waitForHeading(/Tutores disponibles/);

    await userEvent.type(screen.getByLabelText('Materia o tutor'), '  cálculo  ');
    await userEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }));

    await waitFor(() =>
      expect(calls.some((url) => url.includes('q=c%C3%A1lculo'))).toBe(true),
    );
  });

  it('muestra en cada tarjeta los datos para comparar tutores', async () => {
    withStoredSession('STUDENT');
    stubApi({
      '/auth/me': { data: sessionUser('STUDENT') },
      '/tutors': { data: TUTOR_LIST },
    });

    renderApp('/app/reservar');
    await waitForHeading(/Tutores disponibles/);

    const card = await screen.findByRole('button', { name: 'Ver el perfil de Ana Maria Torres' });
    expect(within(card).getByText('Ana Maria Torres')).toBeInTheDocument();
    expect(within(card).getByText('Verificado')).toBeInTheDocument();
    expect(within(card).getByText('Estructuras de Datos')).toBeInTheDocument();
    expect(within(card).getByText(/45\.000/)).toBeInTheDocument();
    expect(within(card).getByText('4.8')).toBeInTheDocument();
    expect(within(card).getByText(/calificación promedio/)).toBeInTheDocument();
    expect(within(card).getByText('Disponibilidad')).toBeInTheDocument();
    expect(within(card).getByText(/7 de noviembre/)).toBeInTheDocument();
  });

  it('identifica un perfil sin calificaciones', async () => {
    withStoredSession('STUDENT');
    stubApi({
      '/auth/me': { data: sessionUser('STUDENT') },
      '/tutors': {
        data: {
          ...TUTOR_LIST,
          items: [{ ...TUTOR_LIST.items[0], averageRating: 0, reviewCount: 0 }],
        },
      },
    });

    renderApp('/app/reservar');
    await waitForHeading(/Tutores disponibles/);

    const card = await screen.findByRole('button', { name: 'Ver el perfil de Ana Maria Torres' });
    expect(within(card).getByText('Sin calificaciones')).toBeInTheDocument();
    expect(within(card).queryByText(/calificación promedio/)).not.toBeInTheDocument();
  });

  it('muestra cuando el tutor no tiene disponibilidad', async () => {
    withStoredSession('STUDENT');
    stubApi({
      '/auth/me': { data: sessionUser('STUDENT') },
      '/tutors': {
        data: {
          ...TUTOR_LIST,
          items: [{ ...TUTOR_LIST.items[0], nextAvailableAt: null, isAvailable: false }],
        },
      },
    });

    renderApp('/app/reservar');
    await waitForHeading(/Tutores disponibles/);

    const card = await screen.findByRole('button', { name: 'Ver el perfil de Ana Maria Torres' });
    expect(within(card).getByText('Sin disponibilidad')).toBeInTheDocument();
    expect(within(card).queryByText(/7 de noviembre/)).not.toBeInTheDocument();
  });
});
