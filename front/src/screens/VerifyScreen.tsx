import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { resendVerification, verifyEmail } from '../api';
import { AuthShell } from '../components/AuthShell';
import { toFriendlyError, type FriendlyError } from '../errors';

interface VerifyLocationState {
  pending?: boolean;
  expiresAt?: string;
  devCode?: string;
}

const RESEND_COOLDOWN_SECONDS = 60;

/** Minutos y segundos que faltan, o null si ya expiró o no hay fecha. */
function remainingSeconds(expiresAt: string | undefined): number | null {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (Number.isNaN(diff)) return null;
  return Math.max(0, Math.floor(diff / 1000));
}

function formatCountdown(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

export function VerifyScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const state = (location.state ?? {}) as VerifyLocationState;

  const [email, setEmail] = useState(searchParams.get('email') ?? '');
  const [code, setCode] = useState(searchParams.get('code') ?? '');
  const [expiresAt, setExpiresAt] = useState(state.expiresAt);
  const [devCode, setDevCode] = useState(state.devCode);
  const [countdown, setCountdown] = useState(() => remainingSeconds(state.expiresAt));
  const [cooldown, setCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [notice, setNotice] = useState<string | null>(
    state.pending ? 'Te enviamos un código de 6 dígitos a tu correo institucional.' : null,
  );
  const [error, setError] = useState<FriendlyError | null>(null);

  const submit = useCallback(
    async (emailValue: string, codeValue: string) => {
      setError(null);
      setLoading(true);
      try {
        await verifyEmail(emailValue, codeValue);
        navigate('/login', {
          replace: true,
          state: { notice: 'Tu cuenta quedó activa. Inicia sesión para continuar.' },
        });
      } catch (verifyError) {
        setError(toFriendlyError(verifyError));
      } finally {
        setLoading(false);
      }
    },
    [navigate],
  );

  // El enlace del correo trae correo y código: se verifica sin pedir nada más.
  const autoVerified = useRef(false);
  useEffect(() => {
    const linkEmail = searchParams.get('email');
    const linkCode = searchParams.get('code');
    if (autoVerified.current || !linkEmail || !linkCode) return;
    autoVerified.current = true;
    void submit(linkEmail, linkCode);
  }, [searchParams, submit]);

  useEffect(() => {
    if (!expiresAt) return;
    setCountdown(remainingSeconds(expiresAt));
    const timer = window.setInterval(() => setCountdown(remainingSeconds(expiresAt)), 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submit(email, code);
  }

  async function handleResend() {
    setError(null);
    setNotice(null);
    setResending(true);
    try {
      const pending = await resendVerification(email);
      setExpiresAt(pending.verificationExpiresAt);
      setDevCode(pending.devVerificationCode);
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setNotice('Si el correo está registrado y sin verificar, enviamos un código nuevo.');
    } catch (resendError) {
      setError(toFriendlyError(resendError));
    } finally {
      setResending(false);
    }
  }

  const expired = countdown === 0;

  return (
    <AuthShell
      title="Verificación de la cuenta"
      lead="Escribe el código que te llegó por correo para activar tu cuenta."
      points={[
        'El código vence 15 minutos después de enviarse.',
        'Puedes pedir uno nuevo cada minuto.',
        'El enlace del correo también activa la cuenta.',
      ]}
    >
      <p className="eyebrow">Paso 2 de 2</p>
      <h2>Confirma tu correo</h2>
      <p className="muted">Ingresa los 6 dígitos del código que te enviamos.</p>

      {notice && (
        <div className="alert alert--success" role="status">
          <p>{notice}</p>
        </div>
      )}

      {devCode && (
        <div className="alert alert--info" role="status">
          <p>
            Modo desarrollo: tu código es <code>{devCode}</code>
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="auth__form" noValidate>
        <div className="field">
          <label className="field__label" htmlFor="verify-email">
            Correo institucional
          </label>
          <input
            id="verify-email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>

        <div className="field">
          <div className="field__meta">
            <label className="field__label" htmlFor="verify-code">
              Código de verificación
            </label>
            {countdown !== null && (
              <span className="field__hint">
                {expired ? 'Código vencido' : `Vence en ${formatCountdown(countdown)}`}
              </span>
            )}
          </div>
          <input
            id="verify-code"
            className="code-input"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            value={code}
            // Solo dígitos: evita pegar el código con espacios o guiones.
            onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            required
          />
        </div>

        {error && (
          <div className="alert alert--error" role="alert">
            <p>{error.message}</p>
            {error.details.length > 0 && (
              <ul>
                {error.details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <button
          type="submit"
          className="button button--primary button--wide"
          disabled={loading || code.length !== 6}
        >
          {loading ? 'Verificando...' : 'Activar mi cuenta'}
        </button>
      </form>

      <button
        type="button"
        className="button button--ghost button--wide"
        onClick={() => void handleResend()}
        disabled={resending || cooldown > 0 || email.trim() === ''}
      >
        {cooldown > 0 ? `Reenviar código (${cooldown}s)` : 'Reenviar código'}
      </button>

      <p className="auth__footer">
        ¿Ya está activa? <Link to="/login">Inicia sesión</Link>
      </p>
    </AuthShell>
  );
}
