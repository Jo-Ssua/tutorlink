import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { AuthProvider } from '../auth/AuthContext';
import { AppRoutes } from '../routes';
import { saveSession } from '../session';
import type { Role, SessionUser } from '../types';

/**
 * Monta la aplicación real (AuthProvider + rutas) sobre un router en memoria.
 * `App.tsx` no sirve aquí porque trae su propio `BrowserRouter`; por eso el
 * árbol de rutas vive en `routes.tsx`.
 */
export function renderApp(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </MemoryRouter>,
  );
}

export function sessionUser(role: Role = 'STUDENT'): SessionUser {
  return {
    id: 'user-1',
    email: 'ana.torres@universidad.edu.co',
    fullName: 'Ana Torres',
    role,
    status: 'ACTIVE',
  };
}

/** Deja una sesión guardada, como si el usuario ya hubiera iniciado sesión. */
export function withStoredSession(role: Role = 'STUDENT'): SessionUser {
  const user = sessionUser(role);
  saveSession({
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    tokenType: 'Bearer',
    expiresIn: '15m',
    refreshExpiresIn: '7d',
    user,
  });

  return user;
}

export interface StubbedRoute {
  status?: number;
  /** Cuerpo de `data` en una respuesta correcta. */
  data?: unknown;
  /** Error de la API, cuando `status` es de fallo. */
  error?: { code: string; message: string };
}

/**
 * Sustituye `fetch` por un doble que responde con el formato real de la API
 * (`{ success, data, meta }`). Las claves son fragmentos de la ruta.
 */
export function stubApi(routes: Record<string, StubbedRoute>) {
  const calls: string[] = [];

  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);

    const key = Object.keys(routes).find((candidate) => url.includes(candidate));
    const route = key ? routes[key] : undefined;
    const status = route?.status ?? (route ? 200 : 404);

    const body =
      status >= 400
        ? {
            success: false,
            error: route?.error ?? { code: 'NOT_STUBBED', message: 'Ruta sin doble: ' + url },
          }
        : { success: true, data: route?.data ?? null };

    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
    );
  });

  vi.stubGlobal('fetch', fetchMock);
  return { calls, fetchMock };
}

export const EMPTY_PAGE = {
  items: [],
  pagination: {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  },
};
