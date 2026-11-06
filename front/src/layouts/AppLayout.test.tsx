import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import {
  EMPTY_PAGE,
  renderApp,
  sessionUser,
  stubApi,
  waitForHeading,
  withStoredSession,
} from '../test/renderApp';

const ADMIN_STATS = {
  users: { students: 2, tutors: 3, admins: 1 },
  applications: { pendingTutorApplications: 1, pendingSubjects: 0 },
  bookings: { pending: 0, confirmed: 0, completed: 0, cancelled: 0 },
  simulatedRevenue: { gross: 0, platformFees: 0, tutorEarnings: 0, currency: 'COP' },
};

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

/** Destinos visibles, sin distinguir barra superior de pestañas inferiores. */
function navDestinations(): string[] {
  return screen
    .getAllByRole('navigation', { name: 'Secciones' })
    .flatMap((nav) => Array.from(nav.querySelectorAll('a')))
    .map((link) => link.getAttribute('href') ?? '');
}

describe('navegación de la aplicación', () => {
  it('ofrece al estudiante sus secciones y ninguna de otro rol', async () => {
    withStoredSession('STUDENT');
    stubApi({
      '/auth/me': { data: sessionUser('STUDENT') },
      '/bookings/my': { data: EMPTY_PAGE },
    });

    renderApp('/app/calificaciones');
    await waitForHeading(/Califica tus tutorías completadas/);

    const destinations = new Set(navDestinations());
    expect(destinations).toContain('/app/reservar');
    expect(destinations).toContain('/app/calificaciones');
    expect(destinations).toContain('/app/postular');
    expect(destinations).not.toContain('/app/tutor');
    expect(destinations).not.toContain('/app/admin');
  });

  it('no le muestra al tutor las secciones del estudiante ni del admin', async () => {
    withStoredSession('TUTOR');
    stubApi({
      '/auth/me': { data: sessionUser('TUTOR') },
      '/bookings/tutor': { data: EMPTY_PAGE },
    });

    renderApp('/app/tutor');
    await waitForHeading(/Hola, Ana/);

    const destinations = new Set(navDestinations());
    expect(destinations).toEqual(new Set(['/app/tutor', '/app/oferta']));
  });

  it('no le muestra al admin las secciones de los demás roles', async () => {
    withStoredSession('ADMIN');
    stubApi({
      '/auth/me': { data: sessionUser('ADMIN') },
      '/admin/stats': { data: ADMIN_STATS },
      '/admin/tutor-applications': { data: EMPTY_PAGE },
    });

    renderApp('/app/admin');
    await waitForHeading(/Estado de la plataforma/);

    const destinations = new Set(navDestinations());
    expect(destinations).toEqual(new Set(['/app/admin']));
  });

  it('da pestañas inferiores solo cuando hay más de un destino', async () => {
    withStoredSession('ADMIN');
    stubApi({
      '/auth/me': { data: sessionUser('ADMIN') },
      '/admin/stats': { data: ADMIN_STATS },
      '/admin/tutor-applications': { data: EMPTY_PAGE },
    });

    renderApp('/app/admin');
    await waitForHeading(/Estado de la plataforma/);

    // Con un solo destino no hay entre qué moverse: solo queda la barra superior.
    expect(screen.getAllByRole('navigation', { name: 'Secciones' })).toHaveLength(1);
  });

  it('le da al tutor su propia pestaña de oferta', async () => {
    withStoredSession('TUTOR');
    stubApi({
      '/auth/me': { data: sessionUser('TUTOR') },
      '/bookings/tutor': { data: EMPTY_PAGE },
    });

    renderApp('/app/tutor');
    await waitForHeading(/Hola, Ana/);

    // Dos destinos: la barra superior y las pestañas inferiores.
    expect(screen.getAllByRole('navigation', { name: 'Secciones' })).toHaveLength(2);
  });
});
