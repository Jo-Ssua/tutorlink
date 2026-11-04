import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { Role } from '../types';
import { homePathFor, useAuth } from './AuthContext';

/**
 * Deja pasar solo con sesión. Sin ella redirige a `/login` guardando la ruta
 * pedida en `state.from`, para volver a ella después de iniciar sesión.
 */
export function ProtectedRoute() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return <SessionCheck />;
  }

  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  return <Outlet />;
}

/**
 * Restringe una sección a ciertos roles. Va siempre dentro de
 * `<ProtectedRoute>`, así que aquí ya hay sesión: un rol que no corresponde se
 * manda a su propia pantalla inicial, no al login.
 *
 * La redirección es muda a propósito. Decirle a un estudiante que esa sección
 * «es solo para tutores» le dibuja el mapa de roles y secciones de la
 * plataforma; quien no puede entrar tampoco necesita saber que existe. La
 * navegación solo ofrece rutas alcanzables, así que aquí solo se llega
 * escribiendo la URL a mano.
 */
export function RoleRoute({ roles }: { roles: Role[] }) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!roles.includes(user.role)) {
    return <Navigate to={homePathFor(user.role)} replace />;
  }

  return <Outlet />;
}

/** Envía a cada rol a su pantalla inicial. */
export function RoleHomeRedirect() {
  const { user, status } = useAuth();

  if (status === 'loading') {
    return <SessionCheck />;
  }

  return <Navigate to={user ? homePathFor(user.role) : '/login'} replace />;
}

export function SessionCheck() {
  return (
    <main className="dashboard">
      <section className="panel panel--center" aria-busy="true">
        <p className="muted">Verificando tu sesión...</p>
      </section>
    </main>
  );
}
