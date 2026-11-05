import {
  Button,
  Description,
  FieldError,
  Input,
  Label,
  ListBox,
  Select,
  TextField,
} from '@heroui/react';
import { CheckCircleIcon, CircleIcon } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getPrograms, register } from '../api';
import { acceptedEmailFormat, isInstitutionalEmail } from '../auth/institutionalEmail';
import { isPasswordValid, passwordRules, passwordScore } from '../auth/passwordRules';
import { AuthShell } from '../components/AuthShell';
import { FormError } from '../components/FormFeedback';
import { fieldMessages, toFriendlyError, type FriendlyError } from '../errors';
import type { Program } from '../types';

const STRENGTH_LABELS = ['Muy débil', 'Débil', 'Aceptable', 'Buena', 'Fuerte'];
const STRENGTH_BAR = [
  'w-1/5 bg-danger',
  'w-2/5 bg-danger',
  'w-3/5 bg-warning',
  'w-4/5 bg-accent',
  'w-full bg-success',
];

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
  // Validar mientras se teclea marca en rojo un correo que aún no se termina de
  // escribir, así que el aviso espera a que el campo pierda el foco.
  const [emailTouched, setEmailTouched] = useState(false);

  useEffect(() => {
    // El catálogo es público: si falla, el programa simplemente queda opcional.
    getPrograms()
      .then(setPrograms)
      .catch(() => setPrograms([]));
  }, []);

  const rules = passwordRules(password);
  const score = passwordScore(password);
  const emailIsWrong = emailTouched && email.trim() !== '' && !isInstitutionalEmail(email);
  const passwordsDiffer = confirmation !== '' && confirmation !== password;

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
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-1">
          <p className="text-xs font-bold tracking-widest text-accent uppercase">Nueva cuenta</p>
          <h2 className="text-2xl font-bold text-foreground">Crea tu cuenta</h2>
          <p className="text-muted">Formato aceptado: {acceptedEmailFormat()}</p>
        </header>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <TextField
            isRequired
            fullWidth
            name="fullName"
            value={fullName}
            onChange={setFullName}
            isInvalid={Boolean(fields.fullName?.length)}
          >
            <Label>Nombre completo</Label>
            <Input autoComplete="name" />
            {fields.fullName?.length ? <FieldError>{fields.fullName[0]}</FieldError> : null}
          </TextField>

          <TextField
            isRequired
            fullWidth
            name="email"
            type="email"
            value={email}
            onChange={setEmail}
            isInvalid={emailIsWrong || Boolean(fields.email?.length)}
          >
            <Label>Correo institucional</Label>
            <Input autoComplete="username" onBlur={() => setEmailTouched(true)} />
            <Description>Usa el correo que te dio tu universidad.</Description>
            {emailIsWrong ? (
              <FieldError>Solo aceptamos {acceptedEmailFormat()}</FieldError>
            ) : fields.email?.length ? (
              <FieldError>{fields.email[0]}</FieldError>
            ) : null}
          </TextField>

          <TextField
            isRequired
            fullWidth
            name="password"
            type="password"
            value={password}
            onChange={setPassword}
            isInvalid={Boolean(fields.password?.length)}
          >
            <Label>Contraseña</Label>
            <Input autoComplete="new-password" />
            {fields.password?.length ? <FieldError>{fields.password[0]}</FieldError> : null}
          </TextField>

          {password !== '' && (
            <div className="flex flex-col gap-2">
              <div aria-hidden="true" className="h-1.5 rounded-full bg-default">
                <div className={`h-full rounded-full transition-all ${STRENGTH_BAR[score]}`} />
              </div>
              <p className="text-sm text-muted">Seguridad: {STRENGTH_LABELS[score]}</p>
            </div>
          )}

          <ul className="flex flex-col gap-1 text-sm">
            {rules.map((rule) => (
              <li
                key={rule.label}
                className={`flex items-center gap-2 ${rule.met ? 'text-success' : 'text-muted'}`}
              >
                {rule.met ? (
                  <CheckCircleIcon aria-hidden="true" size={16} weight="fill" />
                ) : (
                  <CircleIcon aria-hidden="true" size={16} />
                )}
                {rule.label}
              </li>
            ))}
          </ul>

          <TextField
            isRequired
            fullWidth
            name="confirmation"
            type="password"
            value={confirmation}
            onChange={setConfirmation}
            isInvalid={passwordsDiffer}
          >
            <Label>Repite la contraseña</Label>
            <Input autoComplete="new-password" />
            {passwordsDiffer && <FieldError>Las contraseñas no coinciden.</FieldError>}
          </TextField>

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              fullWidth
              name="studentCode"
              value={studentCode}
              onChange={setStudentCode}
              isInvalid={Boolean(fields.studentCode?.length)}
            >
              <Label>Código estudiantil (opcional)</Label>
              <Input />
              {fields.studentCode?.length ? (
                <FieldError>{fields.studentCode[0]}</FieldError>
              ) : null}
            </TextField>

            <TextField fullWidth name="semester" type="number" value={semester} onChange={setSemester}>
              <Label>Semestre (opcional)</Label>
              <Input max="20" min="1" inputMode="numeric" />
            </TextField>
          </div>

          {programs.length > 0 && (
            <Select
              fullWidth
              name="programId"
              placeholder="Prefiero no decirlo"
              value={programId || null}
              onChange={(value) => setProgramId(value ? String(value) : '')}
            >
              <Label>Programa académico (opcional)</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {programs.map((program) => (
                    <ListBox.Item
                      key={program.id}
                      id={program.id}
                      textValue={`${program.name} · ${program.faculty.name}`}
                    >
                      {program.name} · {program.faculty.name}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          )}

          <FormError error={error} />

          <Button type="submit" size="lg" className="w-full" isDisabled={loading}>
            {loading ? 'Creando cuenta...' : 'Crear cuenta'}
          </Button>
        </form>

        <p className="text-sm text-muted">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="font-semibold text-accent underline">
            Inicia sesión
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
