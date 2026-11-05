import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  renderApp,
  sessionUser,
  stubApi,
  waitForHeading,
  withStoredSession,
} from '../test/renderApp';
import type { TutorOwnProfile } from '../types';

const profile = (overrides: Partial<TutorOwnProfile> = {}): TutorOwnProfile => ({
  id: 'tutor-1',
  fullName: 'Ana Torres',
  email: 'ana.torres@universidad.edu.co',
  bio: 'Diez años explicando estructuras de datos.',
  experienceYears: 10,
  hourlyRate: 45_000,
  verificationStatus: 'VERIFIED',
  rejectionReason: null,
  modalities: ['VIRTUAL'],
  isActive: true,
  maxWeeklySessions: null,
  subjects: [
    {
      id: 'link-1',
      status: 'VERIFIED',
      evidenceUrl: null,
      rejectionReason: null,
      subject: { id: 'subject-1', code: 'ISIS-1225', name: 'Estructuras de Datos' },
    },
  ],
  nextAvailability: [],
  ...overrides,
});

function stubProfile(own: TutorOwnProfile) {
  return stubApi({
    '/auth/me': { data: sessionUser('TUTOR') },
    '/tutor/profile': { data: own },
    '/tutor/availability': { data: [] },
  });
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe('configuración de la oferta del tutor', () => {
  it('carga el perfil en el formulario', async () => {
    withStoredSession('TUTOR');
    stubProfile(profile());

    renderApp('/app/oferta');
    await waitForHeading(/Configuración del perfil/);

    expect(screen.getByLabelText('Biografía')).toHaveValue(
      'Diez años explicando estructuras de datos.',
    );
    expect(screen.getByLabelText('Tarifa por hora (COP)')).toHaveValue(45000);
    expect(screen.getByRole('checkbox', { name: 'Virtual' })).toBeChecked();
    expect(screen.getByText('Estructuras de Datos')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar perfil' })).toBeEnabled();
  });

  it('bloquea las ediciones mientras la verificación esté pendiente', async () => {
    withStoredSession('TUTOR');
    stubProfile(profile({ verificationStatus: 'PENDING', rejectionReason: null }));

    renderApp('/app/oferta');
    await waitForHeading(/Configuración del perfil/);

    expect(screen.getByLabelText('Biografía')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Guardar perfil' })).toBeDisabled();
    expect(screen.getByText(/Las ediciones se habilitan/)).toBeInTheDocument();
  });
});
