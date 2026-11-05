import { Button, Input, Label, TextField } from '@heroui/react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { acceptedEmailFormat } from '../auth/institutionalEmail';
import { toFriendlyError, type FriendlyError } from '../errors';
import { AuthShell } from './AuthShell';
import { FormError, FormNotice } from './FormFeedback';

interface LoginCardProps {
  /** Aviso que llega de otra pantalla, por ejemplo al verificar la cuenta. */
  notice?: string;
}

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
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-1">
          <p className="text-xs font-bold tracking-widest text-accent uppercase">Acceso</p>
          <h2 className="text-2xl font-bold text-foreground">Inicia sesión</h2>
          <p className="text-muted">Entra con tu correo institucional.</p>
        </header>

        {notice && <FormNotice>{notice}</FormNotice>}

        {expired && (
          <div className="flex flex-col items-start gap-3">
            <FormNotice status="accent">
              Tu sesión se cerró. Inicia sesión otra vez para continuar.
            </FormNotice>
            <Button size="sm" variant="tertiary" onPress={dismissExpired}>
              Entendido
            </Button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <TextField isRequired fullWidth name="email" type="email" value={email} onChange={setEmail}>
            <Label>Correo institucional</Label>
            <Input
              autoComplete="username"
              placeholder={`nombre${acceptedEmailFormat().split(' o ')[0]}`}
            />
          </TextField>

          <TextField
            isRequired
            fullWidth
            name="password"
            type="password"
            value={password}
            onChange={setPassword}
          >
            <Label>Contraseña</Label>
            <Input autoComplete="current-password" />
          </TextField>

          <FormError error={error} />

          <Button type="submit" size="lg" className="w-full" isDisabled={loading}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </Button>
        </form>

        <div className="flex flex-col gap-2 text-sm text-muted">
          <p>
            ¿No tienes cuenta?{' '}
            <Link to="/registro" className="font-semibold text-accent underline">
              Regístrate con tu correo institucional
            </Link>
          </p>
          <p>
            ¿No recibiste el código?{' '}
            <Link to="/verificar" className="font-semibold text-accent underline">
              Verifica tu cuenta
            </Link>
          </p>
        </div>
      </div>
    </AuthShell>
  );
}
