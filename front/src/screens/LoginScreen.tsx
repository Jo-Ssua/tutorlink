import { Navigate, useLocation } from 'react-router-dom';
import { homePathFor, useAuth } from '../auth/AuthContext';
import { SessionCheck } from '../auth/ProtectedRoute';
import { LoginCard } from '../components/LoginCard';

/**
 * Ruta `/login`. El formulario vive en `LoginCard`; aquí solo se decide a dónde
 * ir: a la ruta que el usuario intentaba abrir (`state.from`, que guarda
 * `ProtectedRoute`) o a la pantalla inicial de su rol. `state.notice` trae el
 * aviso de la pantalla de verificacion.
 */
export function LoginScreen() {
  const { status, user } = useAuth();
  const location = useLocation();
  const state = location.state as { from?: string; notice?: string } | null;
  const from = state?.from;

  if (status === 'loading') {
    return <SessionCheck />;
  }

  if (user) {
    return <Navigate to={from ?? homePathFor(user.role)} replace />;
  }

  return <LoginCard notice={state?.notice} />;
}
