import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderApp, sessionUser, stubApi, withStoredSession } from '../test/renderApp';
import type { RequestItem, RequestsDashboard } from '../solicitudes/types';

const SUBJECT = { id: 'subject-1', code: 'MAT-101', name: 'Cálculo I' };

const pending: RequestItem = {
  id: 'booking-1',
  studentAlias: 'Estudiante #A1B2C3',
  subject: SUBJECT,
  topic: 'Derivadas e integrales',
  description: 'Repaso para el parcial del viernes',
  startAt: '2026-12-01T14:00:00.000Z',
  endAt: '2026-12-01T15:00:00.000Z',
  durationMinutes: 60,
  modality: 'VIRTUAL',
  status: 'PENDING',
  rate: 30_000,
  subtotal: 30_000,
  total: 33_000,
  isEmergency: false,
  cancellationReason: null,
  createdAt: '2026-11-10T10:00:00.000Z',
  canRespond: true,
};

const expired: RequestItem = {
  ...pending,
  id: 'booking-expired',
  topic: 'Sesión que ya pasó',
  startAt: '2026-11-01T14:00:00.000Z',
  canRespond: false,
};

const accepted: RequestItem = { ...pending, id: 'b-acc', topic: 'Límites', status: 'ACCEPTED' };
const rejected: RequestItem = {
  ...pending,
  id: 'b-rej',
  topic: 'Series',
  status: 'REJECTED',
  cancellationReason: 'No tengo cupo ese día',
};
const upcoming: RequestItem = { ...pending, id: 'b-up', topic: 'Matrices', status: 'CONFIRMED' };

const dashboard = (overrides: Partial<RequestsDashboard> = {}): RequestsDashboard => ({
  counts: { pending: 1, accepted: 1, rejected: 1, upcoming: 1 },
  pending: [pending],
  accepted: [accepted],
  rejected: [rejected],
  upcoming: [upcoming],
  ...overrides,
});

function stubDashboard(data: RequestsDashboard = dashboard()) {
  return stubApi({
    '/auth/me': { data: sessionUser('TUTOR') },
    '/tutor/requests/dashboard': { data },
    '/bookings/booking-1/accept': { data: { message: 'ok' } },
    '/bookings/booking-1/reject': { data: { message: 'ok' } },
    '/bookings/booking-expired/accept': {
      status: 409,
      error: { code: 'BOOKING_EXPIRED', message: 'La hora de esta solicitud ya pasó.' },
    },
  });
}

/** Llamadas de escritura hechas, como `[url, método, cuerpo]`. */
function writes(fetchMock: ReturnType<typeof stubApi>['fetchMock']) {
  const calls = fetchMock.mock.calls as unknown as Array<[RequestInfo, RequestInit?]>;

  return calls
    .filter(([, init]) => init?.method === 'POST')
    .map(([url, init]) => [String(url), init?.body] as const);
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe('panel de solicitudes del tutor', () => {
  it('muestra pendientes, aceptadas, rechazadas y próximas sesiones con sus totales', async () => {
    withStoredSession('TUTOR');
    stubDashboard();

    renderApp('/app/solicitudes');

    expect(await screen.findByRole('heading', { name: 'Pendientes' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Próximas sesiones' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Aceptadas' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Rechazadas' })).toBeInTheDocument();

    expect(screen.getByText('Derivadas e integrales')).toBeInTheDocument();
    expect(screen.getByText('Límites')).toBeInTheDocument();
    expect(screen.getByText('Series')).toBeInTheDocument();
    expect(screen.getByText('Matrices')).toBeInTheDocument();
    expect(screen.getByText('Motivo: No tengo cupo ese día')).toBeInTheDocument();

    const stats = screen.getByLabelText('Resumen de solicitudes');
    expect(within(stats).getByText('Pendientes')).toBeInTheDocument();
    expect(within(stats).getByText('Próximas sesiones')).toBeInTheDocument();
  });

  it('al abrir una solicitud muestra materia, tema, fecha, modalidad y tarifa', async () => {
    withStoredSession('TUTOR');
    stubDashboard();
    const user = userEvent.setup();

    renderApp('/app/solicitudes');
    await user.click(await screen.findByRole('button', { name: /Revisar solicitud/ }));

    const detail = screen.getByRole('group', { name: 'Solicitud de Derivadas e integrales' });
    for (const label of ['Materia', 'Tema', 'Fecha y hora', 'Modalidad', 'Tarifa por hora']) {
      expect(within(detail).getByText(label)).toBeInTheDocument();
    }
    expect(within(detail).getByText('MAT-101 · Cálculo I')).toBeInTheDocument();
    expect(within(detail).getByText('Virtual')).toBeInTheDocument();
    expect(within(detail).getAllByText(/30\.000/).length).toBeGreaterThan(0);
    expect(within(detail).getByText('Repaso para el parcial del viernes')).toBeInTheDocument();
  });

  it('aceptar pide confirmación y no cambia nada hasta confirmarla', async () => {
    withStoredSession('TUTOR');
    const { fetchMock } = stubDashboard();
    const user = userEvent.setup();

    renderApp('/app/solicitudes');
    await user.click(await screen.findByRole('button', { name: /Revisar solicitud/ }));
    await user.click(screen.getByRole('button', { name: 'Aceptar' }));

    expect(screen.getByRole('group', { name: 'Confirmar aceptación' })).toBeInTheDocument();
    expect(writes(fetchMock)).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'Confirmar aceptación' }));

    expect(await screen.findByText(/Solicitud aceptada\. El estudiante fue notificado/)).toBeInTheDocument();
    expect(writes(fetchMock)).toHaveLength(1);
    expect(writes(fetchMock)[0][0]).toContain('/bookings/booking-1/accept');
  });

  it('cancelar la confirmación no envía nada', async () => {
    withStoredSession('TUTOR');
    const { fetchMock } = stubDashboard();
    const user = userEvent.setup();

    renderApp('/app/solicitudes');
    await user.click(await screen.findByRole('button', { name: /Revisar solicitud/ }));
    await user.click(screen.getByRole('button', { name: 'Rechazar' }));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('group', { name: 'Confirmar rechazo' })).not.toBeInTheDocument();
    expect(writes(fetchMock)).toHaveLength(0);
  });

  it('rechazar envía el motivo opcional y avisa que el estudiante fue notificado', async () => {
    withStoredSession('TUTOR');
    const { fetchMock } = stubDashboard();
    const user = userEvent.setup();

    renderApp('/app/solicitudes');
    await user.click(await screen.findByRole('button', { name: /Revisar solicitud/ }));
    await user.click(screen.getByRole('button', { name: 'Rechazar' }));
    await user.type(screen.getByLabelText(/Motivo/), '  No tengo cupo  ');
    await user.click(screen.getByRole('button', { name: 'Confirmar rechazo' }));

    expect(await screen.findByText(/Solicitud rechazada\. El estudiante fue notificado/)).toBeInTheDocument();
    const [[url, body]] = writes(fetchMock);
    expect(url).toContain('/bookings/booking-1/reject');
    expect(JSON.parse(String(body))).toEqual({ reason: 'No tengo cupo' });
  });

  it('rechazar sin motivo envía un cuerpo vacío', async () => {
    withStoredSession('TUTOR');
    const { fetchMock } = stubDashboard();
    const user = userEvent.setup();

    renderApp('/app/solicitudes');
    await user.click(await screen.findByRole('button', { name: /Revisar solicitud/ }));
    await user.click(screen.getByRole('button', { name: 'Rechazar' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar rechazo' }));

    await waitFor(() => expect(writes(fetchMock)).toHaveLength(1));
    expect(JSON.parse(String(writes(fetchMock)[0][1]))).toEqual({});
  });

  it('una solicitud cuya hora ya pasó no se puede aceptar, solo rechazar', async () => {
    withStoredSession('TUTOR');
    stubDashboard(dashboard({ pending: [expired], counts: { pending: 1, accepted: 0, rejected: 0, upcoming: 0 }, accepted: [], rejected: [], upcoming: [] }));
    const user = userEvent.setup();

    renderApp('/app/solicitudes');
    await user.click(await screen.findByRole('button', { name: /Revisar solicitud/ }));

    expect(screen.getByRole('button', { name: 'Aceptar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Rechazar' })).toBeEnabled();
    expect(screen.getByText(/ya pasó, así que no se puede aceptar/)).toBeInTheDocument();
  });

  it('si la API rechaza la acción muestra el motivo y la solicitud sigue ahí', async () => {
    withStoredSession('TUTOR');
    stubApi({
      '/auth/me': { data: sessionUser('TUTOR') },
      '/tutor/requests/dashboard': { data: dashboard() },
      '/bookings/booking-1/accept': {
        status: 409,
        error: { code: 'INVALID_BOOKING_STATE', message: 'La solicitud ya fue respondida' },
      },
    });
    const user = userEvent.setup();

    renderApp('/app/solicitudes');
    await user.click(await screen.findByRole('button', { name: /Revisar solicitud/ }));
    await user.click(screen.getByRole('button', { name: 'Aceptar' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar aceptación' }));

    expect(await screen.findByText('La solicitud ya fue respondida')).toBeInTheDocument();
    expect(screen.queryByText(/Solicitud aceptada/)).not.toBeInTheDocument();
  });

  it('sin solicitudes pendientes lo explica', async () => {
    withStoredSession('TUTOR');
    stubDashboard(
      dashboard({
        pending: [],
        accepted: [],
        rejected: [],
        upcoming: [],
        counts: { pending: 0, accepted: 0, rejected: 0, upcoming: 0 },
      }),
    );

    renderApp('/app/solicitudes');

    expect(await screen.findByText('No tienes solicitudes por responder')).toBeInTheDocument();
  });

  it('muestra el error de carga con reintento', async () => {
    withStoredSession('TUTOR');
    stubApi({
      '/auth/me': { data: sessionUser('TUTOR') },
      '/tutor/requests/dashboard': {
        status: 500,
        error: { code: 'INTERNAL', message: 'Falló el servidor' },
      },
    });

    renderApp('/app/solicitudes');

    expect(await screen.findByText('Falló el servidor')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });

  it('un estudiante no puede entrar al panel del tutor', async () => {
    withStoredSession('STUDENT');
    stubApi({ '/auth/me': { data: sessionUser('STUDENT') } });

    renderApp('/app/solicitudes');

    await waitFor(() =>
      expect(screen.queryByText('Solicitudes de tutoría')).not.toBeInTheDocument(),
    );
  });
});
