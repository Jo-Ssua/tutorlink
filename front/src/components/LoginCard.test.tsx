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

  it('no enumera cuentas ni roles antes de autenticar', async () => {
    stubApi({});
    const { container } = renderApp('/login');

    await screen.findByRole('heading', { name: 'Inicia sesión' });

    // Ni un correo del seed, ni donde buscar su contrasena.
    expect(container.textContent).not.toMatch(/@universidad\.edu\.co/);
    expect(container.textContent).not.toMatch(/README/i);
    expect(screen.queryByRole('button', { name: /Administrador/i })).toBeNull();
  });

  it('no publica la direccion de la API', async () => {
    stubApi({});
    const { container } = renderApp('/login');

    await screen.findByRole('heading', { name: 'Inicia sesión' });

    expect(container.querySelector('code')).toBeNull();
    expect(container.textContent).not.toMatch(/\/api\/v1/);
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
