import { useState } from 'react';
import { Link } from 'react-router-dom';
import { API_URL } from '../api';
import { useAuth } from '../auth/AuthContext';
import { acceptedEmailFormat } from '../auth/institutionalEmail';
import { toFriendlyError, type FriendlyError } from '../errors';
import { AuthShell } from './AuthShell';

interface LoginCardProps {
  /** Aviso que llega de otra pantalla, por ejemplo al verificar la cuenta. */
  notice?: string;
}

/** Correos del seed, para no escribirlos a mano en desarrollo. */
const DEMO_EMAILS = [
  { label: 'María · sesiones ya calificadas', email: 'estudiante@universidad.edu.co' },
  {
    label: 'Juan · sesiones por calificar',
    email: 'juan.estudiante@estudiantes.universidad.edu.co',
  },
  { label: 'Ana · tutora', email: 'ana.tutor@universidad.edu.co' },
  { label: 'Administrador', email: 'admin@universidad.edu.co' },
];

export function LoginCard({ notice }: LoginCardProps) {
  const { signIn, expired, dismissExpired } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<FriendlyError | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      // El AuthProvider se encarga del estado y de llevarnos a la pantalla del rol.
      await signIn(email.trim(), password);
    } catch (loginError) {
      setError(toFriendlyError(loginError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Tutorías con tus compañeros de universidad."
      lead="Reserva una sesión, paga de forma simulada y califica al tutor cuando termine."
      points={[
        'Tutores verificados con su correo institucional.',
        'Horarios reales, siempre actualizados.',
        'Reseñas de estudiantes que ya tomaron la sesión.',
      ]}
    >
      <p className="eyebrow">Acceso</p>
      <h2>Inicia sesión</h2>
      <p className="muted">Entra con tu correo institucional.</p>

      {notice && (
        <div className="alert alert--success" role="status">
          <p>{notice}</p>
        </div>
      )}

      {expired && (
        <div className="alert alert--error" role="status">
          <p>Tu sesión se cerró. Inicia sesión otra vez para continuar.</p>
          <button
            type="button"
            className="button button--ghost button--small"
            onClick={dismissExpired}
          >
            Entendido
          </button>
        </div>
      )}

      {/* Atajo solo para desarrollo: rellena el correo, nunca la contraseña. */}
      {import.meta.env.DEV && (
        <div className="demo-users" aria-label="Cuentas de prueba">
          {DEMO_EMAILS.map((demo) => (
            <button
              key={demo.email}
              type="button"
              className={`demo-user${email === demo.email ? ' demo-user--active' : ''}`}
              onClick={() => {
                setEmail(demo.email);
                setError(null);
              }}
            >
              {demo.label}
            </button>
          ))}
          <p className="field__hint">La contraseña de estas cuentas está en el README.</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="auth__form" noValidate>
        <div className="field">
          <label className="field__label" htmlFor="login-email">
            Correo institucional
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="username"
            placeholder={`nombre${acceptedEmailFormat().split(' o ')[0]}`}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>

        <div className="field">
          <label className="field__label" htmlFor="login-password">
            Contraseña
          </label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
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

        <button type="submit" className="button button--primary button--wide" disabled={loading}>
          {loading ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>

      <p className="auth__footer">
        ¿No tienes cuenta? <Link to="/registro">Regístrate con tu correo institucional</Link>
      </p>
      <p className="auth__footer">
        ¿No recibiste el código? <Link to="/verificar">Verifica tu cuenta</Link>
      </p>

      <p className="auth__api">
        API: <code>{API_URL}</code>
      </p>
    </AuthShell>
  );
}
