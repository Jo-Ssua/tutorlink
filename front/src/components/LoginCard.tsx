import { useState } from 'react';
import { login, API_URL } from '../api';
import { toFriendlyError, type FriendlyError } from '../errors';
import type { SessionUser } from '../types';

interface LoginCardProps {
  onLoggedIn: (user: SessionUser) => void;
}

const DEMO_USERS = [
  {
    label: 'María · sesiones ya calificadas',
    email: 'estudiante@universidad.edu.co',
  },
  {
    label: 'Juan · sesiones por calificar',
    email: 'juan.estudiante@estudiantes.universidad.edu.co',
  },
];

const DEMO_PASSWORD = 'TutorLink123*';

export function LoginCard({ onLoggedIn }: LoginCardProps) {
  const [email, setEmail] = useState(DEMO_USERS[1].email);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<FriendlyError | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await login(email.trim(), password);
      onLoggedIn(result.user);
    } catch (loginError) {
      setError(toFriendlyError(loginError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth">
      <section className="auth__intro">
        <span className="brand brand--light">TutorLink</span>
        <h1>Tu opinión ayuda a otros estudiantes a elegir mejor.</h1>
        <p>
          Califica de 1 a 5 estrellas a tu tutor después de una sesión completada y deja
          una reseña verificada.
        </p>
        <ul className="auth__points">
          <li>Solo sesiones completadas pueden calificarse.</li>
          <li>Una reseña por sesión, sin duplicados.</li>
          <li>El promedio del tutor se actualiza al enviar.</li>
        </ul>
      </section>

      <section className="auth__panel">
        <div className="auth__card">
          <p className="eyebrow">Acceso de estudiante</p>
          <h2>Inicia sesión para calificar</h2>
          <p className="muted">Usa las credenciales demo del seed o tu cuenta institucional.</p>

          <div className="demo-users" aria-label="Cuentas demo">
            {DEMO_USERS.map((user) => (
              <button
                key={user.email}
                type="button"
                className={`demo-user${email === user.email ? ' demo-user--active' : ''}`}
                onClick={() => {
                  setEmail(user.email);
                  setPassword(DEMO_PASSWORD);
                  setError(null);
                }}
              >
                {user.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="auth__form" noValidate>
            <div className="field">
              <label className="field__label" htmlFor="login-email">
                Correo institucional
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="username"
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

          <p className="auth__api">
            API: <code>{API_URL}</code>
          </p>
        </div>
      </section>
    </main>
  );
}
