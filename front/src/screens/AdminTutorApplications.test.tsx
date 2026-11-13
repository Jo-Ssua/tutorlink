import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  renderApp,
  sessionUser,
  stubApi,
  waitForHeading,
  withStoredSession,
} from '../test/renderApp';
import type { TutorApplication } from '../types';

const application = (overrides: Partial<TutorApplication> = {}): TutorApplication => ({
  id: 'application-1',
  userId: 'user-9',
  fullName: 'Lucía Peña',
  institutionalEmail: 'lucia.pena@universidad.edu.co',
  userStatus: 'ACTIVE',
  role: 'STUDENT',
  emailVerifiedAt: '2026-11-01T12:00:00.000Z',
  verificationStatus: 'PENDING',
  rejectionReason: null,
  bio: 'Diez años explicando estructuras de datos.',
  hourlyRate: 45_000,
  experienceYears: 4,
  modalities: ['VIRTUAL'],
  createdAt: '2026-11-05T12:00:00.000Z',
  subjects: [
    {
      id: 'link-1',
      status: 'PENDING',
      evidenceUrl: 'https://drive.universidad.edu.co/soporte-isis1225.pdf',
      grade: 4.5,
      approvedSemester: 5,
      rejectionReason: null,
      subject: { id: 'subject-1', code: 'ISIS-1225', name: 'Estructuras de Datos' },
    },
  ],
  professors: [{ id: 'professor-1', fullName: 'Carlos Ruiz', email: null }],
  ...overrides,
});

function page(items: TutorApplication[]) {
  return {
    items,
    pagination: {
      page: 1,
      limit: 20,
      total: items.length,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    },
  };
}

function stubApplications(
  items: TutorApplication[],
  actions: Record<string, { status?: number; data?: unknown; error?: { code: string; message: string } }> = {},
) {
  return stubApi({
    '/auth/me': { data: sessionUser('ADMIN') },
    '/notifications/unread-count': { data: { unreadCount: 0 } },
    ...actions,
    '/admin/tutor-applications': { data: page(items) },
  });
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe('revisión de postulaciones de tutor', () => {
  it('muestra correo institucional, materias declaradas y el soporte de cada una', async () => {
    withStoredSession('ADMIN');
    stubApplications([application()]);

    renderApp('/app/admin/postulaciones');
    await waitForHeading(/Revisión de postulaciones/);

    expect(await screen.findByText('Lucía Peña')).toBeInTheDocument();
    expect(screen.getByText('lucia.pena@universidad.edu.co')).toBeInTheDocument();
    expect(screen.getByText('ISIS-1225 · Estructuras de Datos')).toBeInTheDocument();
    expect(screen.getByText(/Nota 4\.5/)).toBeInTheDocument();
    expect(screen.getByText(/Semestre 5/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver soporte' })).toHaveAttribute(
      'href',
      'https://drive.universidad.edu.co/soporte-isis1225.pdf',
    );
  });

  it('avisa cuando una materia llega sin soporte', async () => {
    withStoredSession('ADMIN');
    stubApplications([
      application({
        subjects: [
          {
            id: 'link-2',
            status: 'PENDING',
            evidenceUrl: null,
            grade: null,
            approvedSemester: null,
            rejectionReason: null,
            subject: { id: 'subject-2', code: 'MATE-1203', name: 'Cálculo I' },
          },
        ],
      }),
    ]);

    renderApp('/app/admin/postulaciones');
    await waitForHeading(/Revisión de postulaciones/);

    expect(await screen.findByText('Sin soporte')).toBeInTheDocument();
    expect(screen.getByText(/Sin nota declarada/)).toBeInTheDocument();
  });

  it('aprueba la postulación y confirma que el usuario quedó como tutor verificado', async () => {
    withStoredSession('ADMIN');
    const { calls } = stubApplications([application()], {
      '/approve': {
        data: {
          application: {
            id: 'application-1',
            userId: 'user-9',
            fullName: 'Lucía Peña',
            institutionalEmail: 'lucia.pena@universidad.edu.co',
            verificationStatus: 'VERIFIED',
            verifiedAt: '2026-11-13T12:00:00.000Z',
          },
          message: 'Postulacion aprobada. El usuario ahora tiene el rol TUTOR.',
        },
      },
    });

    renderApp('/app/admin/postulaciones');
    await waitForHeading(/Revisión de postulaciones/);

    await userEvent.click(await screen.findByRole('button', { name: 'Aprobar postulación' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar aprobación' }));

    expect(await screen.findByText(/rol de tutor verificado/)).toBeInTheDocument();
    expect(calls.some((url) => url.includes('/admin/tutor-applications/application-1/approve'))).toBe(
      true,
    );
    expect(screen.queryByText('Lucía Peña')).not.toBeInTheDocument();
  });

  it('no envía el rechazo sin motivo', async () => {
    withStoredSession('ADMIN');
    const { calls } = stubApplications([application()]);

    renderApp('/app/admin/postulaciones');
    await waitForHeading(/Revisión de postulaciones/);

    await userEvent.click(await screen.findByRole('button', { name: 'Rechazar postulación' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar rechazo' }));

    expect(await screen.findByText(/Escribe el motivo del rechazo/)).toBeInTheDocument();
    expect(calls.some((url) => url.includes('/reject'))).toBe(false);
    expect(screen.getByText('Lucía Peña')).toBeInTheDocument();
  });

  it('envía el motivo del rechazo y avisa que es visible para el solicitante', async () => {
    withStoredSession('ADMIN');
    const { calls, fetchMock } = stubApplications([application()], {
      '/reject': {
        data: {
          id: 'application-1',
          verificationStatus: 'REJECTED',
          reason: 'El soporte de Estructuras de Datos no es legible',
          message: 'Postulacion rechazada.',
        },
      },
    });

    renderApp('/app/admin/postulaciones');
    await waitForHeading(/Revisión de postulaciones/);

    await userEvent.click(await screen.findByRole('button', { name: 'Rechazar postulación' }));
    await userEvent.type(
      screen.getByLabelText('Motivo del rechazo'),
      'El soporte de Estructuras de Datos no es legible',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar rechazo' }));

    expect(await screen.findByText(/visible para el solicitante/)).toBeInTheDocument();
    expect(calls.some((url) => url.includes('/admin/tutor-applications/application-1/reject'))).toBe(
      true,
    );

    const rejectCall = fetchMock.mock.calls.find((call) =>
      String(call[0]).includes('/reject'),
    ) as unknown as [RequestInfo | URL, RequestInit] | undefined;
    expect(JSON.parse(String(rejectCall?.[1].body))).toEqual({
      reason: 'El soporte de Estructuras de Datos no es legible',
    });
  });

  it('muestra el error de la API cuando la aprobación no procede', async () => {
    withStoredSession('ADMIN');
    stubApplications([application({ subjects: [] })], {
      '/approve': {
        status: 409,
        error: {
          code: 'APPLICATION_WITHOUT_SUBJECTS',
          message: 'La postulacion no tiene materias declaradas',
        },
      },
    });

    renderApp('/app/admin/postulaciones');
    await waitForHeading(/Revisión de postulaciones/);

    await userEvent.click(await screen.findByRole('button', { name: 'Aprobar postulación' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar aprobación' }));

    expect(await screen.findByText('La postulacion no tiene materias declaradas')).toBeInTheDocument();
    // La ficha sigue en la lista: el título y el aviso de confirmación la nombran.
    expect(screen.getAllByText('Lucía Peña').length).toBeGreaterThan(0);
  });

  it('pide el estado elegido al servidor', async () => {
    withStoredSession('ADMIN');
    const { calls } = stubApplications([application()]);

    renderApp('/app/admin/postulaciones');
    await waitForHeading(/Revisión de postulaciones/);
    await screen.findByText('Lucía Peña');

    expect(calls.some((url) => url.includes('status=PENDING'))).toBe(true);

    await userEvent.type(screen.getByLabelText('Buscar por nombre o correo'), 'ana');
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }));

    await waitFor(() => expect(calls.some((url) => url.includes('search=ana'))).toBe(true));
  });
});
