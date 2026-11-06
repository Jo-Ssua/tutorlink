import { NavLink } from 'react-router-dom';
import type { NavItem } from '../layouts/navigation';

/**
 * Pestañas inferiores, como en los wireframes. Solo en pantallas menores a
 * `lg`: desde ahí los mismos destinos ya están en la barra superior.
 *
 * Cada pestaña mide 44 px de alto como mínimo y reserva el hueco de la barra de
 * gestos con `safe-area-inset-bottom`.
 */
export function BottomNav({ items }: { items: NavItem[] }) {
  return (
    <nav
      aria-label="Secciones"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="mx-auto flex max-w-lg items-stretch">
        {items.map(({ to, label, Icon }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              className={({ isActive }) =>
                [
                  'flex min-h-14 flex-col items-center justify-center gap-1 px-2 py-2 text-xs font-semibold transition-colors',
                  isActive ? 'text-accent' : 'text-muted',
                ].join(' ')
              }
            >
              {({ isActive }) => (
                <>
                  <Icon aria-hidden="true" size={24} weight={isActive ? 'fill' : 'regular'} />
                  <span className="text-center leading-tight">{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
