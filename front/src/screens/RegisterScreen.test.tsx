import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp, stubApi } from '../test/renderApp';

const PROGRAMS = [
  {
    id: 'program-1',
    name: 'Ingeniería de Sistemas',
    code: 'IS',
    faculty: { id: 'faculty-1', name: 'Ingeniería', code: 'ING' },
  },
];

const PENDING = {
  email: 'nueva@universidad.edu.co',
  verificationRequired: true,
  verificationExpiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  message: 'Revisa tu correo',
};

/** Rellena el formulario con datos válidos; cada test cambia lo que necesita. */
async function fillForm(overrides: { email?: string; password?: string; confirm?: string } = {}) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Nombre completo'), 'Nueva Estudiante');
  await user.type(
    screen.getByLabelText('Correo institucional'),
    overrides.email ?? 'nueva@universidad.edu.co',
  );
  await user.type(screen.getByLabelText('Contraseña'), overrides.password ?? 'Segura123');
  await user.type(
    screen.getByLabelText('Repite la contraseña'),
    overrides.confirm ?? overrides.password ?? 'Segura123',
  );
  return user;
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe('registro con correo institucional', () => {
  it('rechaza un correo no institucional e informa el formato aceptado', async () => {
    const { calls } = stubApi({ '/catalog/programs': { data: PROGRAMS } });
    renderApp('/registro');

    const user = await fillForm({ email: 'nueva@gmail.com' });
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/correo institucional/i);
    expect(alert).toHaveTextContent(/@universidad\.edu\.co/);
    // Ni siquiera se llama a la API: la validación es local.
    expect(calls.some((url) => url.includes('/auth/register'))).toBe(false);
  });

  it('exige que la contraseña cumpla las reglas del backend', async () => {
    const { calls } = stubApi({ '/catalog/programs': { data: PROGRAMS } });
    renderApp('/registro');

    const user = await fillForm({ password: 'corta' });
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/requisitos mínimos/i);
    expect(calls.some((url) => url.includes('/auth/register'))).toBe(false);
  });

  it('avisa cuando la confirmación no coincide', async () => {
    stubApi({ '/catalog/programs': { data: PROGRAMS } });
    renderApp('/registro');

    const user = await fillForm({ password: 'Segura123', confirm: 'Segura124' });
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/no coinciden/i);
  });

  it('registra y lleva a la pantalla de verificación con el correo', async () => {
    const { calls } = stubApi({
      '/catalog/programs': { data: PROGRAMS },
      '/auth/register': { data: PENDING },
    });
    renderApp('/registro');

    // El programa llega del catálogo público. La lista solo existe con el
    // desplegable abierto, así que hay que abrirlo para verla.
    const picker = await screen.findByRole('button', { name: /Programa académico/ });
    await userEvent.click(picker);
    expect(
      await screen.findByRole('option', { name: /Ingeniería de Sistemas/ }),
    ).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');

    const user = await fillForm();
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(await screen.findByRole('heading', { name: 'Confirma tu correo' })).toBeInTheDocument();
    expect(screen.getByLabelText('Correo institucional')).toHaveValue(
      'nueva@universidad.edu.co',
    );
    expect(calls.some((url) => url.includes('/auth/register'))).toBe(true);
  });

  it('muestra el mensaje del backend cuando rechaza el dominio', async () => {
    stubApi({
      '/catalog/programs': { data: PROGRAMS },
      '/auth/register': {
        status: 400,
        error: {
          code: 'NON_INSTITUTIONAL_EMAIL',
          message: 'Solo se aceptan correos @universidad.edu.co',
        },
      },
    });
    renderApp('/registro');

    const user = await fillForm();
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /Solo se aceptan correos @universidad\.edu\.co/,
    );
  });
});
