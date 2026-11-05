import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp, stubApi } from '../test/renderApp';

const EMAIL = 'nueva@universidad.edu.co';

const VERIFIED = {
  verified: true,
  user: { id: 'user-9', email: EMAIL, role: 'STUDENT', status: 'ACTIVE' },
};

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe('verificación de la cuenta', () => {
  it('activa la cuenta con el código y manda al login con el aviso', async () => {
    const { calls } = stubApi({ '/auth/verify-email': { data: VERIFIED } });
    renderApp(`/verificar?email=${encodeURIComponent(EMAIL)}`);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Código de verificación'), '123456');
    await user.click(screen.getByRole('button', { name: 'Activar mi cuenta' }));

    expect(
      await screen.findByRole('heading', { name: 'Inicia sesión' }),
    ).toBeInTheDocument();
    expect(await screen.findByRole('status')).toHaveTextContent(/cuenta quedó activa/);
    await waitFor(() => expect(calls.some((url) => url.includes('/auth/verify-email'))).toBe(true));
  });

  it('verifica sola cuando el enlace del correo trae correo y codigo', async () => {
    const { calls } = stubApi({ '/auth/verify-email': { data: VERIFIED } });
    renderApp(`/verificar?email=${encodeURIComponent(EMAIL)}&code=654321`);

    expect(
      await screen.findByRole('heading', { name: 'Inicia sesión' }),
    ).toBeInTheDocument();
    await waitFor(() => expect(calls.some((url) => url.includes('/auth/verify-email'))).toBe(true));
  });

  it('muestra el error cuando el codigo no sirve y deja reintentar', async () => {
    stubApi({
      '/auth/verify-email': {
        status: 400,
        error: { code: 'INVALID_VERIFICATION_CODE', message: 'Codigo invalido' },
      },
    });
    renderApp(`/verificar?email=${encodeURIComponent(EMAIL)}&code=000000`);

    expect(await screen.findByRole('alert')).toHaveTextContent(/El código no es válido/);
    expect(screen.getByRole('heading', { name: 'Confirma tu correo' })).toBeInTheDocument();
  });

  it('reenvia el codigo y bloquea el boton durante la espera', async () => {
    const { calls } = stubApi({
      '/auth/resend-verification': {
        data: {
          email: EMAIL,
          verificationRequired: true,
          verificationExpiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          message: 'Revisa tu correo',
        },
      },
    });
    renderApp(`/verificar?email=${encodeURIComponent(EMAIL)}`);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Reenviar código' }));

    expect(await screen.findByRole('status')).toHaveTextContent(/enviamos un código nuevo/);
    expect(await screen.findByRole('button', { name: /Reenviar código \(\d+s\)/ })).toBeDisabled();
    expect(calls.some((url) => url.includes('/auth/resend-verification'))).toBe(true);
  });
});
