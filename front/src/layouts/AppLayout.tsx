import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { TopBar } from '../components/TopBar';

/** Marco de las secciones con sesión: barra superior y aviso de acceso denegado. */
export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const deniedRoles = (location.state as { deniedRoles?: string[] } | null)?.deniedRoles;
  const [denied, setDenied] = useState<string[] | null>(deniedRoles ?? null);

  // El aviso se muestra una sola vez: se limpia el state para que no reaparezca
  // al recargar ni al volver con el botón del navegador.
  useEffect(() => {
    if (!deniedRoles) return;

    setDenied(deniedRoles);
    navigate(location.pathname + location.search, { replace: true, state: null });
  }, [deniedRoles, location.pathname, location.search, navigate]);

  return (
    <div className="app">
      <TopBar />

      {denied && (
        <div className="dashboard">
          <div className="alert alert--error" role="alert">
            <p>
              Esa sección está disponible solo para {denied.map(roleLabel).join(' y ')}. Te
              llevamos a tu inicio.
            </p>
            <button
              type="button"
              className="button button--ghost button--small"
              onClick={() => setDenied(null)}
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      <Outlet />
    </div>
  );
}

function roleLabel(role: string): string {
  switch (role) {
    case 'STUDENT':
      return 'estudiantes';
    case 'TUTOR':
      return 'tutores';
    case 'ADMIN':
      return 'administradores';
    default:
      return role;
  }
}
