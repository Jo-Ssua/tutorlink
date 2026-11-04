import { Outlet } from 'react-router-dom';
import { TopBar } from '../components/TopBar';

/** Marco de las secciones con sesión. */
export function AppLayout() {
  return (
    <div className="app">
      <TopBar />
      <Outlet />
    </div>
  );
}
