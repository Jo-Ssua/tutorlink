import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp, stubApi } from '../test/renderApp';

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe('pantalla de inicio de sesion', () => {
  it('no precarga ninguna contrasena', async () => {
    stubApi({});
    renderApp('/login');

    await screen.findByRole('heading', { name: 'Inicia sesión' });

    expect(screen.getByLabelText('Correo institucional')).toHaveValue('');
    expect(screen.getByLabelText('Contraseña')).toHaveValue('');
  });

  it('los atajos de desarrollo solo rellenan el correo', async () => {
    stubApi({});
    renderApp('/login');

    const shortcut = await screen.findByRole('button', { name: /Ana · tutora/ });
    await userEvent.click(shortcut);

    expect(screen.getByLabelText('Correo institucional')).toHaveValue(
      'ana.tutor@universidad.edu.co',
    );
    // El atajo nunca escribe la contrasena: hay que teclearla.
    expect(screen.getByLabelText('Contraseña')).toHaveValue('');
  });

  it('ofrece registrarse y verificar la cuenta', async () => {
    stubApi({});
    renderApp('/login');

    await screen.findByRole('heading', { name: 'Inicia sesión' });

    expect(screen.getByRole('link', { name: /Regístrate/ })).toHaveAttribute('href', '/registro');
    expect(screen.getByRole('link', { name: /Verifica tu cuenta/ })).toHaveAttribute(
      'href',
      '/verificar',
    );
  });

  it('lleva a la pantalla de registro', async () => {
    stubApi({ '/catalog/programs': { data: [] } });
    renderApp('/login');

    await userEvent.click(await screen.findByRole('link', { name: /Regístrate/ }));

    expect(await screen.findByRole('heading', { name: 'Crea tu cuenta' })).toBeInTheDocument();
  });
});
