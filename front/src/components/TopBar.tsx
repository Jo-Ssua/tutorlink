import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import type { Role } from '../types';

const NAV_BY_ROLE: Record<Role, Array<{ to: string; label: string }>> = {
  STUDENT: [
    { to: '/app/calificaciones', label: 'Calificaciones' },
    { to: '/app/reservar', label: 'Reservar tutoría' },
  ],
  TUTOR: [{ to: '/app/tutor', label: 'Mis sesiones' }],
  ADMIN: [{ to: '/app/admin', label: 'Administración' }],
};

export function TopBar() {
  const { user, signOut } = useAuth();
  const links = user ? NAV_BY_ROLE[user.role] : [];

  return (
    <header className="topbar">
      <div className="topbar__inner">
        <div className="brand">
          <span className="brand__mark" aria-hidden="true">
            TL
          </span>
          TutorLink
        </div>

        {links.length > 0 && (
          <nav className="topbar__user" aria-label="Secciones">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `button button--small ${isActive ? 'button--primary' : 'button--ghost'}`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        )}

        <div className="topbar__user">
          {user && <span className="topbar__name">{user.fullName}</span>}
          <button
            type="button"
            className="button button--ghost button--small"
            onClick={() => void signOut()}
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </header>
  );
}
