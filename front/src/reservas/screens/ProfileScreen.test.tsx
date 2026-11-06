import { screen } from '@testing-library/react';
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
      reviewCount: 2,
      verificationStatus: 'VERIFIED',
      subjects: [{ id: 'subject-1', code: 'SIS201', name: 'Estructuras de Datos' }],
      nextAvailableAt: '2026-11-07T15:00:00.000Z',
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
  averageRating: 4.5,
  reviewCount: 2,
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
  recentReviews: [
    {
      rating: 5,
      comment: 'Explicó muy bien los grafos.',
      createdAt: '2026-10-21T18:00:00.000Z',
      subject: 'Estructuras de Datos',
    },
    // Una reseña puede ser solo estrellas, sin comentario.
    {
      rating: 4,
      comment: null,
      createdAt: '2026-09-02T18:00:00.000Z',
      subject: 'Estructuras de Datos',
    },
  ],
  nextAvailability: [],
};

/** El orden importa: `stubApi` empareja por subcadena y toma la primera clave. */
function stubProfile(profile: unknown = PROFILE) {
  return stubApi({
    '/auth/me': { data: sessionUser('STUDENT') },
    '/catalog': { data: [] },
    '/tutors/tutor-1': { data: profile },
    '/tutors': { data: TUTOR_LIST },
  });
}

async function openProfile() {
  renderApp('/app/reservar');
  await waitForHeading(/Tutores disponibles/);
  await userEvent.click(
    await screen.findByRole('button', { name: 'Ver el perfil de Ana Maria Torres' }),
  );
  await waitForHeading(/Perfil del tutor/);
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe('perfil público del tutor', () => {
  it('muestra el estado de verificación junto al nombre', async () => {
    withStoredSession('STUDENT');
    stubProfile();

    await openProfile();

    expect(screen.getByText('Verificado')).toBeInTheDocument();
  });

  it('muestra presentación, experiencia, tarifa, modalidades y materias verificadas', async () => {
    withStoredSession('STUDENT');
    stubProfile();

    await openProfile();

    expect(screen.getByText(/Monitora de algoritmos/)).toBeInTheDocument();
    expect(screen.getByText('3 años')).toBeInTheDocument();
    expect(screen.getByText(/45\.000/)).toBeInTheDocument();
    expect(screen.getByText('Virtual')).toBeInTheDocument();
    // La materia sale como chip verificado y otra vez en cada reseña.
    expect(screen.getAllByText('Estructuras de Datos').length).toBeGreaterThan(0);
  });

  it('cada reseña trae calificación, materia y fecha', async () => {
    withStoredSession('STUDENT');
    stubProfile();

    await openProfile();

    expect(screen.getByLabelText('5 de 5 estrellas')).toBeInTheDocument();
    expect(screen.getByText('21 de octubre de 2026')).toBeInTheDocument();
    expect(screen.getByText('2 de septiembre de 2026')).toBeInTheDocument();
    expect(screen.getByText(/Explicó muy bien los grafos/)).toBeInTheDocument();
  });

  it('sin reseñas lo dice en vez de inventar una calificación', async () => {
    withStoredSession('STUDENT');
    stubProfile({
      ...PROFILE,
      averageRating: 0,
      reviewCount: 0,
      hasReviews: false,
      recentReviews: [],
    });

    await openProfile();

    expect(screen.getByText(/Perfil nuevo · sin reseñas aún/)).toBeInTheDocument();
    expect(screen.getByText(/aún no tiene reseñas verificadas/)).toBeInTheDocument();
    expect(screen.getByText('Sin calificación')).toBeInTheDocument();
  });
});
