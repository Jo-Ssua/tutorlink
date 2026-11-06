import { Button } from '@heroui/react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { navItemsFor } from '../layouts/navigation';

/**
 * Barra superior. En escritorio lleva además los destinos del rol; en móvil
 * esos destinos viven en la barra inferior y aquí solo quedan la marca y la
 * cuenta, para no repetir la navegación dos veces en una pantalla estrecha.
 */
export function TopBar() {
  const { user, signOut } = useAuth();
  const items = navItemsFor(user?.role);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur-sm pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-4 sm:px-6">
        <p className="flex items-center gap-2 font-bold text-foreground">
          <span
            aria-hidden="true"
            className="grid size-8 place-items-center rounded-lg bg-accent text-sm text-accent-foreground"
          >
            TL
          </span>
          TutorLink
        </p>

        {items.length > 0 && (
          <nav aria-label="Secciones" className="ml-4 hidden lg:block">
            <ul className="flex items-center gap-1">
              {items.map(({ to, label, Icon }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    className={({ isActive }) =>
                      [
                        'flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors',
                        isActive
                          ? 'bg-accent text-accent-foreground'
                          : 'text-muted hover:bg-default hover:text-foreground',
                      ].join(' ')
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon
                          aria-hidden="true"
                          size={20}
                          weight={isActive ? 'fill' : 'regular'}
                        />
                        {label}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        )}

        <div className="ml-auto flex items-center gap-3">
          {user && (
            <span className="hidden text-sm text-muted sm:inline">{user.fullName}</span>
          )}
          <Button size="sm" variant="tertiary" onPress={() => void signOut()}>
            Cerrar sesión
          </Button>
        </div>
      </div>
    </header>
  );
}
