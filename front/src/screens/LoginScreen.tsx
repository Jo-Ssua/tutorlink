import { Navigate, useLocation } from 'react-router-dom';
import { homePathFor, useAuth } from '../auth/AuthContext';
import { SessionCheck } from '../auth/ProtectedRoute';
import { LoginCard } from '../components/LoginCard';

/**
 * Ruta `/login`. El formulario vive en `LoginCard`; aquí solo se decide a dónde
 * ir: a la ruta que el usuario intentaba abrir (`state.from`, que guarda
 * `ProtectedRoute`) o a la pantalla inicial de su rol.
 */
export function LoginScreen() {
  const { status, user } = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  if (status === 'loading') {
    return <SessionCheck />;
  }

  if (user) {
    return <Navigate to={from ?? homePathFor(user.role)} replace />;
  }

  return <LoginCard />;
}
