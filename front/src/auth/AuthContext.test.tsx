import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SESSION_KEY } from '../session';
import {
  EMPTY_PAGE,
  renderApp,
  sessionUser,
  stubApi,
  withStoredSession,
} from '../test/renderApp';

const LOGIN_HEADING = 'Inicia sesión';
const RATINGS_HEADING = /Califica tus tutorías completadas/;

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe('ciclo de vida de la sesion', () => {
  it('vuelve al login cuando la API no puede renovar el token', async () => {
    withStoredSession('STUDENT');
    stubApi({
      '/auth/me': { data: sessionUser('STUDENT') },
      '/bookings/my': {
        status: 401,
        error: { code: 'TOKEN_REVOKED', message: 'Sesion cerrada' },
      },
      '/auth/refresh': {
        status: 401,
        error: { code: 'REFRESH_TOKEN_REVOKED', message: 'Revocado' },
      },
    });

    renderApp('/app/calificaciones');

    expect(await screen.findByRole('heading', { name: LOGIN_HEADING })).toBeInTheDocument();
    expect(await screen.findByRole('status')).toHaveTextContent(/Tu sesión se cerró/);
    expect(window.localStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it('cierra la sesion al pulsar el boton de la barra superior', async () => {
    withStoredSession('STUDENT');
    const { calls } = stubApi({
      '/auth/me': { data: sessionUser('STUDENT') },
      '/bookings/my': { data: EMPTY_PAGE },
      '/auth/logout': { data: { loggedOut: true } },
    });

    renderApp('/app/calificaciones');
    await screen.findByRole('heading', { name: RATINGS_HEADING });

    await userEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

    expect(await screen.findByRole('heading', { name: LOGIN_HEADING })).toBeInTheDocument();
    await waitFor(() => expect(calls.some((url) => url.includes('/auth/logout'))).toBe(true));
    expect(window.localStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it('se entera del cierre de sesion hecho en otra pestana', async () => {
    withStoredSession('STUDENT');
    stubApi({
      '/auth/me': { data: sessionUser('STUDENT') },
      '/bookings/my': { data: EMPTY_PAGE },
    });

    renderApp('/app/calificaciones');
    await screen.findByRole('heading', { name: RATINGS_HEADING });

    // Otra pestana cierra la sesion: el navegador avisa con el evento `storage`.
    window.localStorage.removeItem(SESSION_KEY);
    window.dispatchEvent(new StorageEvent('storage', { key: SESSION_KEY, newValue: null }));

    expect(await screen.findByRole('heading', { name: LOGIN_HEADING })).toBeInTheDocument();
  });

  it('inicia sesion y lleva a la pantalla del rol', async () => {
    stubApi({
      '/auth/login': {
        data: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          tokenType: 'Bearer',
          expiresIn: '15m',
          refreshExpiresIn: '7d',
          user: sessionUser('STUDENT'),
        },
      },
      '/bookings/my': { data: EMPTY_PAGE },
    });

    renderApp('/login');
    await screen.findByRole('heading', { name: LOGIN_HEADING });

    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(await screen.findByRole('heading', { name: RATINGS_HEADING })).toBeInTheDocument();
    expect(window.localStorage.getItem(SESSION_KEY)).not.toBeNull();
  });

  it('muestra el mensaje de la API cuando las credenciales no sirven', async () => {
    stubApi({
      '/auth/login': {
        status: 401,
        error: { code: 'INVALID_CREDENTIALS', message: 'Credenciales invalidas' },
      },
    });

    renderApp('/login');
    await userEvent.click(await screen.findByRole('button', { name: 'Ingresar' }));

    // `errors.ts` reemplaza el mensaje del backend por uno uniforme: el usuario no
    // debe saber si falló el correo o la contraseña.
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /Correo o contraseña incorrectos/,
    );
    expect(window.localStorage.getItem(SESSION_KEY)).toBeNull();
  });
});
