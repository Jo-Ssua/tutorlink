import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  EMPTY_PAGE,
  renderApp,
  sessionUser,
  stubApi,
  waitForHeading,
  withStoredSession,
} from '../test/renderApp';
import type { HistoryDetail, HistoryItem, HistorySummary } from '../historial/types';

const SUBJECT = { id: 'subject-1', code: 'MAT-101', name: 'Cálculo I' };

const reviewed: HistoryItem = {
  id: 'booking-1',
  studentAlias: 'Estudiante #A1B2C3',
  subject: SUBJECT,
  topic: 'Derivadas e integrales',
  startAt: '2026-10-01T14:00:00.000Z',
  endAt: '2026-10-01T15:00:00.000Z',
  durationMinutes: 60,
  modality: 'VIRTUAL',
  status: 'COMPLETED',
  rate: 30_000,
  subtotal: 30_000,
  total: 33_000,
  isEmergency: false,
  review: {
    rating: 5,
    comment: 'Explica muy claro, me ayudó mucho.',
    isAnonymous: true,
    createdAt: '2026-10-02T10:00:00.000Z',
  },
};

const unreviewed: HistoryItem = {
  ...reviewed,
  id: 'booking-2',
  studentAlias: 'Estudiante #D4E5F6',
  topic: 'Límites',
  startAt: '2026-09-20T14:00:00.000Z',
  status: 'CANCELLED',
  review: null,
};

const summary: HistorySummary = {
  totalSessions: 2,
  sessionsByStatus: {
    PENDING: 0,
    ACCEPTED: 0,
    CONFIRMED: 0,
    COMPLETED: 1,
    REJECTED: 0,
    CANCELLED: 1,
  },
  completedSessions: 1,
  reviewCount: 1,
  averageRating: 5,
  ratingDistribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 1 },
  firstSessionAt: '2026-09-20T14:00:00.000Z',
  subjects: [SUBJECT],
};

const detailOf = (item: HistoryItem): HistoryDetail => ({
  ...item,
  description: 'Repaso para el parcial',
  platformFee: 3_000,
  tutorEarnings: 30_000,
  cancellationReason: null,
  cancelledAt: null,
  completedAt: null,
  createdAt: '2026-09-30T10:00:00.000Z',
  payment: null,
});

const page = (items: HistoryItem[]) => ({
  items,
  pagination: { ...EMPTY_PAGE.pagination, total: items.length, totalPages: 1 },
});

function stubHistory(items: HistoryItem[] = [reviewed, unreviewed]) {
  return stubApi({
    '/auth/me': { data: sessionUser('TUTOR') },
    // Las rutas más específicas van primero: `stubApi` toma la primera que coincida.
    '/tutor/history/summary': { data: summary },
    '/tutor/history/booking-1': { data: detailOf(reviewed) },
    '/tutor/history/booking-2': { data: detailOf(unreviewed) },
    '/tutor/history?': { data: page(items) },
  });
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe('historial de tutorías del tutor', () => {
  it('lista fecha, estudiante anonimizado, materia, estado y tarifa', async () => {
    withStoredSession('TUTOR');
    stubHistory();

    renderApp('/app/historial');
    await waitForHeading(/Historial de tutorías/);

    expect(await screen.findByText('Derivadas e integrales')).toBeInTheDocument();
    expect(screen.getByText('Estudiante #A1B2C3')).toBeInTheDocument();
    expect(screen.getAllByText(/MAT-101 · Cálculo I/).length).toBeGreaterThan(0);
    // Cada estado aparece como chip de su sesión (y como opción del filtro).
    expect(screen.getAllByText('Completada').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Cancelada').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/30\.000/).length).toBeGreaterThan(0);
    expect(screen.getByText('Sin reseña')).toBeInTheDocument();
  });

  it('muestra el resumen de trayectoria', async () => {
    withStoredSession('TUTOR');
    stubHistory();

    renderApp('/app/historial');
    await waitForHeading(/Historial de tutorías/);

    const stats = await screen.findByLabelText('Resumen de tu trayectoria');
    await waitFor(() => expect(within(stats).getByText('5.0')).toBeInTheDocument());
    expect(within(stats).getByText('Calificación (1)')).toBeInTheDocument();
  });

  it('el detalle de una sesión con reseña muestra calificación y comentario', async () => {
    withStoredSession('TUTOR');
    stubHistory();
    const user = userEvent.setup();

    renderApp('/app/historial');
    await screen.findByText('Derivadas e integrales');

    await user.click(screen.getAllByRole('button', { name: /Ver detalle/ })[0]);

    const detail = await screen.findByLabelText('Detalle de Derivadas e integrales');
    expect(
      await within(detail).findByText(/Explica muy claro, me ayudó mucho\./),
    ).toBeInTheDocument();
    expect(within(detail).getByRole('img', { name: /5 de 5 estrellas/ })).toBeInTheDocument();
  });

  it('el detalle de una sesión sin reseña lo dice', async () => {
    withStoredSession('TUTOR');
    stubHistory();
    const user = userEvent.setup();

    renderApp('/app/historial');
    await screen.findByText('Límites');

    await user.click(screen.getAllByRole('button', { name: /Ver detalle/ })[1]);

    const detail = await screen.findByLabelText('Detalle de Límites');
    expect(await within(detail).findByText('Esta sesión aún no tiene reseña.')).toBeInTheDocument();
  });

  it('al filtrar por fecha consulta de nuevo con el rango, incluyendo el día final', async () => {
    withStoredSession('TUTOR');
    const { calls } = stubHistory();
    const user = userEvent.setup();

    renderApp('/app/historial');
    await screen.findByText('Derivadas e integrales');

    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-10-01' } });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-10-31' } });
    await user.click(screen.getByRole('button', { name: 'Aplicar filtros' }));

    await waitFor(() => {
      const last = decodeURIComponent(calls.filter((url) => url.includes('/tutor/history?')).at(-1)!);
      expect(last).toContain('from=');
      expect(last).toContain('to=');
    });
  });

  it('rechaza un rango invertido sin consultar la API', async () => {
    withStoredSession('TUTOR');
    const { calls } = stubHistory();
    const user = userEvent.setup();

    renderApp('/app/historial');
    await screen.findByText('Derivadas e integrales');
    const before = calls.length;

    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-11-01' } });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-10-01' } });
    await user.click(screen.getByRole('button', { name: 'Aplicar filtros' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/fecha inicial/);
    expect(calls.length).toBe(before);
  });

  it('filtra por estado y por materia y los manda a la API', async () => {
    withStoredSession('TUTOR');
    const { calls } = stubHistory();
    const user = userEvent.setup();

    renderApp('/app/historial');
    await screen.findByText('Derivadas e integrales');

    await user.click(screen.getByRole('button', { name: /Estado/ }));
    await user.click(await screen.findByRole('option', { name: 'Completada' }));
    await user.click(screen.getByRole('button', { name: /Materia/ }));
    await user.click(await screen.findByRole('option', { name: /MAT-101/ }));
    await user.click(screen.getByRole('button', { name: 'Aplicar filtros' }));

    await waitFor(() => {
      const last = calls.filter((url) => url.includes('/tutor/history?')).at(-1)!;
      expect(last).toContain('status=COMPLETED');
      expect(last).toContain('subjectId=subject-1');
    });
  });

  it('sin resultados explica que el historial no cambió y permite limpiar', async () => {
    withStoredSession('TUTOR');
    stubHistory([]);
    const user = userEvent.setup();

    renderApp('/app/historial');
    expect(await screen.findByText('Todavía no tienes sesiones')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-10-01' } });
    await user.click(screen.getByRole('button', { name: 'Aplicar filtros' }));

    expect(await screen.findByText('Ninguna sesión coincide con los filtros')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Limpiar filtros' })[0]);
    expect(await screen.findByText('Todavía no tienes sesiones')).toBeInTheDocument();
  });

  it('muestra el error de carga con reintento', async () => {
    withStoredSession('TUTOR');
    stubApi({
      '/auth/me': { data: sessionUser('TUTOR') },
      '/tutor/history/summary': { data: summary },
      '/tutor/history?': { status: 500, error: { code: 'INTERNAL', message: 'Falló el servidor' } },
    });

    renderApp('/app/historial');

    expect(await screen.findByText('Falló el servidor')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });

  it('un estudiante no puede entrar al historial del tutor', async () => {
    withStoredSession('STUDENT');
    stubApi({ '/auth/me': { data: sessionUser('STUDENT') } });

    renderApp('/app/historial');

    await waitFor(() => expect(screen.queryByText(/Historial de tutorías/)).not.toBeInTheDocument());
  });
});
