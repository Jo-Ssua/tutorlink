import { Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { BottomNav } from '../components/BottomNav';
import { TopBar } from '../components/TopBar';
import { navItemsFor } from './navigation';

/**
 * Marco de las secciones con sesión.
 *
 * La navegación se adapta al ancho: pestañas abajo en móvil y tableta, los
 * mismos destinos en la barra superior desde `lg`. Con un solo destino no hay
 * entre qué moverse, así que la barra inferior no se dibuja.
 */
export function AppLayout() {
  const { user } = useAuth();
  const items = navItemsFor(user?.role);
  const showBottomNav = items.length > 1;

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <TopBar />

      {/* Hueco para que la barra fija no tape el final del contenido. */}
      <div className={`flex-1 ${showBottomNav ? 'pb-20 lg:pb-0' : ''}`}>
        <Outlet />
      </div>

      {showBottomNav && <BottomNav items={items} />}
    </div>
  );
}
