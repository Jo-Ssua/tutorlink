import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import {
  EMPTY_PAGE,
  renderApp,
  sessionUser,
  stubApi,
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

describe('rutas protegidas', () => {
  it('manda al login cuando no hay sesion', async () => {
    stubApi({});
    renderApp('/app/calificaciones');

    expect(await screen.findByRole('heading', { name: 'Inicia sesión' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Califica tus tutorías/ })).not.toBeInTheDocument();
  });

  it('deja entrar al estudiante y confirma la sesion contra la API', async () => {
    withStoredSession('STUDENT');
    const { calls } = stubApi({
      '/auth/me': { data: sessionUser('STUDENT') },
      '/bookings/my': { data: EMPTY_PAGE },
    });

    renderApp('/app/calificaciones');

    expect(
      await screen.findByRole('heading', { name: /Califica tus tutorías completadas/ }),
    ).toBeInTheDocument();
    await waitFor(() => expect(calls.some((url) => url.includes('/auth/me'))).toBe(true));
  });

  it('cierra la sesion guardada si la API la rechaza', async () => {
    withStoredSession('STUDENT');
    stubApi({
      '/auth/me': { status: 401, error: { code: 'TOKEN_REVOKED', message: 'Sesion cerrada' } },
      '/auth/refresh': {
        status: 401,
        error: { code: 'REFRESH_TOKEN_REVOKED', message: 'Revocado' },
      },
    });

    renderApp('/app/calificaciones');

    expect(
      await screen.findByRole('heading', { name: 'Inicia sesión' }),
    ).toBeInTheDocument();
    expect(window.localStorage.length).toBe(0);
  });

  it('envia cada rol a su pantalla inicial desde la raiz', async () => {
    withStoredSession('TUTOR');
    stubApi({
      '/auth/me': { data: sessionUser('TUTOR') },
      '/bookings/tutor': { data: EMPTY_PAGE },
    });

    renderApp('/');

    expect(await screen.findByRole('heading', { name: /Hola, Ana/ })).toBeInTheDocument();
  });

  it('devuelve al estudiante a su inicio si pide una seccion de otro rol', async () => {
    withStoredSession('STUDENT');
    stubApi({
      '/auth/me': { data: sessionUser('STUDENT') },
      '/bookings/my': { data: EMPTY_PAGE },
      '/admin/stats': { data: ADMIN_STATS },
    });

    renderApp('/app/admin');

    expect(
      await screen.findByRole('heading', { name: /Califica tus tutorías completadas/ }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Estado de la plataforma/ })).not.toBeInTheDocument();
  });

  it('no le cuenta al estudiante que la seccion era de otro rol', async () => {
    withStoredSession('STUDENT');
    stubApi({
      '/auth/me': { data: sessionUser('STUDENT') },
      '/bookings/my': { data: EMPTY_PAGE },
      '/admin/stats': { data: ADMIN_STATS },
    });

    const { container } = renderApp('/app/admin');

    await screen.findByRole('heading', { name: /Califica tus tutorías completadas/ });

    // Nada de «esa seccion es solo para administradores»: eso le dibuja al
    // usuario el mapa de roles de la plataforma.
    expect(screen.queryByRole('alert')).toBeNull();
    expect(container.textContent).not.toMatch(/solo para/i);
    expect(container.textContent).not.toMatch(/administradores/i);
  });

  it('deja entrar al administrador a su panel', async () => {
    withStoredSession('ADMIN');
    stubApi({
      '/auth/me': { data: sessionUser('ADMIN') },
      '/admin/stats': { data: ADMIN_STATS },
      '/admin/tutor-applications': { data: EMPTY_PAGE },
    });

    renderApp('/app/admin');

    expect(
      await screen.findByRole('heading', { name: /Estado de la plataforma/ }),
    ).toBeInTheDocument();
  });

  it('atiende /verificar sin sesion, porque es el destino del enlace del correo', async () => {
    stubApi({});
    renderApp('/verificar?email=ana.torres@universidad.edu.co&code=123456');

    expect(
      await screen.findByRole('heading', { name: /Verificación de la cuenta/ }),
    ).toBeInTheDocument();
  });
});
