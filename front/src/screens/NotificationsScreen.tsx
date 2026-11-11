import { BellIcon, CheckIcon, CheckCircleIcon } from '@phosphor-icons/react';
import { Button, Card, Chip } from '@heroui/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ApiError,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../api';
import { LoadError } from '../components/LoadError';
import { NOTIFICATIONS_UPDATED_EVENT } from '../components/NotificationBell';
import { toFriendlyError, type FriendlyError } from '../errors';
import type { Notification, NotificationType } from '../notifications/types';

const dateTimeFormatter = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const TYPE_LABEL: Record<NotificationType, string> = {
  TUTOR_APPLICATION_SUBMITTED: 'Postulación',
  TUTOR_APPLICATION_APPROVED: 'Postulación',
  TUTOR_APPLICATION_REJECTED: 'Postulación',
  TUTOR_SUBJECT_VERIFIED: 'Oferta',
  TUTOR_SUBJECT_REJECTED: 'Oferta',
  TUTORING_REQUEST_CREATED: 'Solicitud',
  BOOKING_CREATED: 'Reserva',
  BOOKING_STATUS_CHANGED: 'Cambio de reserva',
  STUDYMATCH_PROPOSAL: 'StudyMatch',
  STUDYMATCH_PROPOSAL_ACCEPTED: 'StudyMatch',
  STUDYMATCH_PROPOSAL_REJECTED: 'StudyMatch',
  STUDYMATCH_PROPOSAL_EXPIRED: 'StudyMatch',
  STUDYMATCH_NO_TUTORS: 'StudyMatch',
  STUDYMATCH_REQUEST_CONFIRMED: 'StudyMatch',
  REVIEW_RECEIVED: 'Calificación',
  PAYMENT_SIMULATED: 'Pago',
  SYSTEM: 'Sistema',
};

function NotificationItem({
  notification,
  onRead,
}: {
  notification: Notification;
  onRead: (notification: Notification) => void;
}) {
  const isUnread = notification.readAt === null;

  return (
    <Card className={isUnread ? 'border-accent/40' : undefined}>
      <Card.Content className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <span
          aria-hidden="true"
          className={`grid size-10 shrink-0 place-items-center rounded-full ${
            isUnread ? 'bg-accent text-accent-foreground' : 'bg-default text-muted'
          }`}
        >
          {isUnread ? <BellIcon size={20} weight="fill" /> : <CheckIcon size={20} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-bold text-foreground">{notification.title}</h2>
            <Chip size="sm" variant="soft">
              {TYPE_LABEL[notification.type]}
            </Chip>
          </div>
          <p className="mt-1 text-sm text-muted">{notification.message}</p>
          <time className="mt-2 block text-xs text-muted" dateTime={notification.createdAt}>
            {dateTimeFormatter.format(new Date(notification.createdAt))}
          </time>
        </div>
        {isUnread && (
          <Button
            size="sm"
            variant="tertiary"
            className="self-start sm:shrink-0"
            onPress={() => onRead(notification)}
          >
            Marcar como leída
          </Button>
        )}
      </Card.Content>
    </Card>
  );
}

export function NotificationsScreen() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [error, setError] = useState<FriendlyError | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getNotifications();
      setNotifications(result.items);
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'SESSION_EXPIRED') return;
      setError(toFriendlyError(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => notification.readAt === null).length,
    [notifications],
  );

  async function handleRead(notification: Notification) {
    try {
      await markNotificationRead(notification.id);
      setNotifications((current) =>
        current.map((item) =>
          item.id === notification.id
            ? { ...item, readAt: new Date().toISOString() }
            : item,
        ),
      );
      window.dispatchEvent(new Event(NOTIFICATIONS_UPDATED_EVENT));
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'SESSION_EXPIRED') return;
      setError(toFriendlyError(caught));
    }
  }

  async function handleMarkAllRead() {
    setMarkingAll(true);
    try {
      await markAllNotificationsRead();
      const readAt = new Date().toISOString();
      setNotifications((current) =>
        current.map((notification) => ({ ...notification, readAt })),
      );
      window.dispatchEvent(new Event(NOTIFICATIONS_UPDATED_EVENT));
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'SESSION_EXPIRED') return;
      setError(toFriendlyError(caught));
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Notificaciones</h1>
          <p className="text-sm text-muted sm:text-base">
            Mantente al tanto de nuevas solicitudes, cambios y cancelaciones.
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            size="sm"
            variant="tertiary"
            isDisabled={markingAll}
            onPress={() => void handleMarkAllRead()}
          >
            <CheckCircleIcon aria-hidden="true" size={18} />
            Marcar todas como leídas
          </Button>
        )}
      </section>

      {error && <LoadError error={error} onRetry={() => void load()} />}

      {loading && (
        <div className="flex flex-col gap-4" aria-live="polite" aria-busy="true">
          <span className="sr-only">Cargando notificaciones...</span>
          <div className="h-28 animate-pulse rounded-xl bg-default" />
          <div className="h-28 animate-pulse rounded-xl bg-default" />
        </div>
      )}

      {!loading && !error && notifications.length === 0 && (
        <Card>
          <Card.Content className="flex flex-col items-center gap-2 py-12 text-center">
            <BellIcon aria-hidden="true" className="text-muted" size={32} />
            <h2 className="text-lg font-bold text-foreground">No tienes notificaciones</h2>
            <p className="text-sm text-muted">Aquí aparecerán tus novedades.</p>
          </Card.Content>
        </Card>
      )}

      {!loading && notifications.length > 0 && (
        <section className="flex flex-col gap-3" aria-label="Lista de notificaciones">
          {notifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onRead={(item) => void handleRead(item)}
            />
          ))}
        </section>
      )}
    </main>
  );
}
