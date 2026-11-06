import { screen, waitFor } from '@testing-library/react';
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
      subjects: [{ id: 'subject-1', name: 'Estructuras de Datos' }],
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
});
