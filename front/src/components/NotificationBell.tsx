import { BellIcon } from '@phosphor-icons/react';
import { useCallback, useEffect, useState } from 'react';
import { getUnreadNotificationCount } from '../api';
import { useAuth } from '../auth/AuthContext';
import { NavLink } from 'react-router-dom';

const REFRESH_INTERVAL_MS = 30_000;
export const NOTIFICATIONS_UPDATED_EVENT = 'tutorlink:notifications-updated';

export function NotificationBell() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      setUnreadCount(await getUnreadNotificationCount());
    } catch {
      // El indicador no debe impedir la navegación si la API no está disponible.
    }
  }, [user]);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
    const handleUpdate = () => void refresh();
    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, handleUpdate);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, handleUpdate);
    };
  }, [refresh]);

  if (!user) return null;

  return (
    <NavLink
      to="/app/notificaciones"
      aria-label={
        unreadCount > 0
          ? `Notificaciones, ${unreadCount} pendientes`
          : 'Notificaciones'
      }
      className="relative grid size-11 place-items-center rounded-full text-muted transition-colors hover:bg-default hover:text-foreground"
    >
      <BellIcon aria-hidden="true" size={22} weight={unreadCount > 0 ? 'fill' : 'regular'} />
      {unreadCount > 0 && (
        <span
          aria-label={`${unreadCount} notificaciones pendientes`}
          className="absolute right-0.5 top-0.5 grid min-w-5 translate-x-1/4 -translate-y-1/4 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold leading-5 text-danger-foreground"
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </NavLink>
  );
}
