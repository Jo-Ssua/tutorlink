import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getPrograms, register } from '../api';
import { acceptedEmailFormat, isInstitutionalEmail } from '../auth/institutionalEmail';
import { isPasswordValid, passwordRules, passwordScore } from '../auth/passwordRules';
import { AuthShell } from '../components/AuthShell';
import { fieldMessages, toFriendlyError, type FriendlyError } from '../errors';
import type { Program } from '../types';

const STRENGTH_LABELS = ['Muy débil', 'Débil', 'Aceptable', 'Buena', 'Fuerte'];

export function RegisterScreen() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [studentCode, setStudentCode] = useState('');
  const [programId, setProgramId] = useState('');
  const [semester, setSemester] = useState('');
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<FriendlyError | null>(null);
  const [fields, setFields] = useState<Record<string, string[]>>({});

  useEffect(() => {
    // El catálogo es público: si falla, el programa simplemente queda opcional.
    getPrograms()
      .then(setPrograms)
      .catch(() => setPrograms([]));
  }, []);

  const rules = passwordRules(password);
  const score = passwordScore(password);
  const emailLooksInstitutional = email.trim() === '' || isInstitutionalEmail(email);
  const passwordsMatch = confirmation === '' || confirmation === password;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFields({});

    // Validación local: mismo mensaje que daría el backend, pero sin la ida y vuelta.
    if (!isInstitutionalEmail(email)) {
      setError({
        message: 'Usa tu correo institucional para registrarte.',
        details: [`Formato aceptado: ${acceptedEmailFormat()}`],
      });
      return;
    }

    if (!isPasswordValid(password)) {
      setError({
        message: 'La contraseña no cumple los requisitos mínimos.',
        details: rules.filter((rule) => !rule.met).map((rule) => rule.label),
      });
      return;
    }

    if (password !== confirmation) {
      setError({ message: 'Las contraseñas no coinciden.', details: [] });
      return;
    }

    setLoading(true);
    try {
      const pending = await register({
        fullName,
        email,
        password,
        studentCode,
        programId: programId || undefined,
        semester: semester ? Number(semester) : undefined,
      });

      // El código llega por correo; `devVerificationCode` solo existe en desarrollo.
      navigate(`/verificar?email=${encodeURIComponent(pending.email)}`, {
        state: {
          pending: true,
          expiresAt: pending.verificationExpiresAt,
          devCode: pending.devVerificationCode,
        },
      });
    } catch (registerError) {
      setError(toFriendlyError(registerError));
      setFields(fieldMessages(registerError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      wide
      title="Regístrate con el correo de tu universidad."
      lead="Tu comunidad de tutorías es la de tu campus: solo entran correos institucionales."
      points={[
        'Verificamos tu correo con un código de 6 dígitos.',
        'Tu programa académico te sugiere las materias.',
        'Puedes postularte como tutor cuando quieras.',
      ]}
    >
      <p className="eyebrow">Nueva cuenta</p>
      <h2>Crea tu cuenta</h2>
      <p className="muted">Formato aceptado: {acceptedEmailFormat()}</p>

      <form onSubmit={handleSubmit} className="auth__form" noValidate>
        <div className="field">
          <label className="field__label" htmlFor="register-name">
            Nombre completo
          </label>
          <input
            id="register-name"
            type="text"
            autoComplete="name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            required
          />
          {fields.fullName?.map((message) => (
            <p key={message} className="field__error">
              {message}
            </p>
          ))}
        </div>

        <div className="field">
          <label className="field__label" htmlFor="register-email">
            Correo institucional
          </label>
          <input
            id="register-email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={!emailLooksInstitutional}
            required
          />
          {emailLooksInstitutional ? (
            <p className="field__hint">Usa el correo que te dio tu universidad.</p>
          ) : (
            <p className="field__error">Solo aceptamos {acceptedEmailFormat()}</p>
          )}
          {fields.email?.map((message) => (
            <p key={message} className="field__error">
              {message}
            </p>
          ))}
        </div>

        <div className="field">
          <label className="field__label" htmlFor="register-password">
            Contraseña
          </label>
          <input
            id="register-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          {password !== '' && (
            <>
              <div className="strength" aria-hidden="true">
                <span className={`strength__bar strength__bar--${score}`} />
              </div>
              <p className="field__hint">Seguridad: {STRENGTH_LABELS[score]}</p>
            </>
          )}
          <ul className="rules">
            {rules.map((rule) => (
              <li key={rule.label} className={rule.met ? 'rules__item--met' : undefined}>
                {rule.met ? '✓' : '•'} {rule.label}
              </li>
            ))}
          </ul>
          {fields.password?.map((message) => (
            <p key={message} className="field__error">
              {message}
            </p>
          ))}
        </div>

        <div className="field">
          <label className="field__label" htmlFor="register-confirmation">
            Repite la contraseña
          </label>
          <input
            id="register-confirmation"
            type="password"
            autoComplete="new-password"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            aria-invalid={!passwordsMatch}
            required
          />
          {!passwordsMatch && <p className="field__error">Las contraseñas no coinciden.</p>}
        </div>

        <div className="field-row">
          <div className="field">
            <label className="field__label" htmlFor="register-student-code">
              Código estudiantil <span className="field__optional">(opcional)</span>
            </label>
            <input
              id="register-student-code"
              type="text"
              value={studentCode}
              onChange={(event) => setStudentCode(event.target.value)}
            />
            {fields.studentCode?.map((message) => (
              <p key={message} className="field__error">
                {message}
              </p>
            ))}
          </div>

          <div className="field">
            <label className="field__label" htmlFor="register-semester">
              Semestre <span className="field__optional">(opcional)</span>
            </label>
            <input
              id="register-semester"
              type="number"
              min={1}
              max={20}
              value={semester}
              onChange={(event) => setSemester(event.target.value)}
            />
          </div>
        </div>

        {programs.length > 0 && (
          <div className="field">
            <label className="field__label" htmlFor="register-program">
              Programa académico <span className="field__optional">(opcional)</span>
            </label>
            <select
              id="register-program"
              value={programId}
              onChange={(event) => setProgramId(event.target.value)}
            >
              <option value="">Prefiero no decirlo</option>
              {programs.map((program) => (
                <option key={program.id} value={program.id}>
                  {program.name} · {program.faculty.name}
                </option>
              ))}
            </select>
            {fields.programId?.map((message) => (
              <p key={message} className="field__error">
                {message}
              </p>
            ))}
          </div>
        )}

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
          {loading ? 'Creando cuenta...' : 'Crear cuenta'}
        </button>
      </form>

      <p className="auth__footer">
        ¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link>
      </p>
    </AuthShell>
  );
}
