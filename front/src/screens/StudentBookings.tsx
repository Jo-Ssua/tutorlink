import {
  Button,
  Card,
  Chip,
  Label,
  TextArea,
  TextField,
} from '@heroui/react';
import { CalendarBlankIcon, LightningIcon } from '@phosphor-icons/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError, cancelBooking, getMyBookings } from '../api';
import { FormError, FormNotice } from '../components/FormFeedback';
import { LoadError } from '../components/LoadError';
import { StatTile } from '../components/StatTile';
import { toFriendlyError, type FriendlyError } from '../errors';
import {
  formatCop,
  formatLongDate,
  formatTimeRange,
  MODALITY_LABEL,
} from '../reservas/format';
import type { Booking, BookingStatus } from '../types';

const STATUS_LABEL: Record<BookingStatus, string> = {
  PENDING: 'Pendiente de respuesta',
  ACCEPTED: 'Aceptada · esperando pago',
  CONFIRMED: 'Confirmada',
  COMPLETED: 'Completada',
  REJECTED: 'Rechazada',
  CANCELLED: 'Cancelada',
};

const STATUS_COLOR: Record<BookingStatus, 'default' | 'warning' | 'success' | 'danger'> = {
  PENDING: 'warning',
  ACCEPTED: 'warning',
  CONFIRMED: 'success',
  COMPLETED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'default',
};

const ACTIVE_STATUSES: BookingStatus[] = ['PENDING', 'ACCEPTED', 'CONFIRMED'];

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</dt>
      <dd className="text-sm text-foreground">{children}</dd>
    </div>
  );
}

function BookingCard({
  booking,
  open,
  saving,
  reason,
  actionError,
  onOpen,
  onReasonChange,
  onCancel,
  onConfirm,
}: {
  booking: Booking;
  open: boolean;
  saving: boolean;
  reason: string;
  actionError: FriendlyError | null;
  onOpen: () => void;
  onReasonChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const policy = booking.cancellationPolicy;
  const cancellable = ACTIVE_STATUSES.includes(booking.status);
  const panelId = `cancel-booking-${booking.id}`;

  return (
    <Card>
      <Card.Header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">
            {booking.subject.code} · {booking.subject.name}
          </p>
          <Card.Title>{booking.topic}</Card.Title>
          <Card.Description>
            {booking.tutor?.fullName ?? 'Tutor'} · {MODALITY_LABEL[booking.modality]}
          </Card.Description>
        </div>
        <div className="flex flex-wrap gap-2 self-start">
          {booking.isEmergency && (
            <Chip size="sm" variant="soft" color="danger">
              <LightningIcon aria-hidden="true" size={14} weight="fill" />
              Emergencia
            </Chip>
          )}
          <Chip size="sm" variant="soft" color={STATUS_COLOR[booking.status]}>
            {STATUS_LABEL[booking.status]}
          </Chip>
        </div>
      </Card.Header>

      <Card.Content className="flex flex-col gap-4">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Meta label="Fecha">{formatLongDate(booking.startAt)}</Meta>
          <Meta label="Hora">{formatTimeRange(booking.startAt, booking.endAt)}</Meta>
          <Meta label="Tarifa">
            <span className="tabular-nums">{formatCop(booking.price.hourlyRate)}/hora</span>
          </Meta>
          <Meta label="Total">
            <span className="tabular-nums">{formatCop(booking.price.total)}</span>
          </Meta>
        </dl>

        {booking.cancellationReason && (
          <p className="text-sm text-muted">
            Motivo: <span className="text-foreground">{booking.cancellationReason}</span>
          </p>
        )}

        {cancellable && policy && (
          <p className="text-sm text-muted">
            {policy.message}{' '}
            {policy.canCancel && (
              <>
                Puedes cancelar hasta el{' '}
                <time dateTime={policy.deadline}>{formatLongDate(policy.deadline)}</time>.
              </>
            )}
          </p>
        )}

        {cancellable && !open && (
          <Button className="self-start" variant="danger-soft" onPress={onOpen}>
            Cancelar reserva
          </Button>
        )}

        {cancellable && open && (
          <div
            id={panelId}
            role="group"
            aria-label={`Confirmar cancelación de ${booking.subject.name}`}
            className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4"
          >
            <p className="text-sm text-foreground">
              ¿Cancelar esta sesión? El tutor recibirá un aviso y la franja volverá a quedar
              disponible.
            </p>
            {policy && !policy.canCancel && (
              <p className="text-sm text-danger">
                Según la política, esta reserva ya no se puede cancelar. Si confirmas, el sistema
                rechazará la cancelación y conservará la reserva.
              </p>
            )}

            <TextField fullWidth value={reason} onChange={onReasonChange}>
              <Label>Motivo (opcional)</Label>
              <TextArea rows={2} maxLength={500} />
            </TextField>

            <FormError error={actionError} />

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="danger" isDisabled={saving} onPress={onConfirm}>
                {saving ? 'Cancelando…' : 'Confirmar cancelación'}
              </Button>
              <Button variant="tertiary" isDisabled={saving} onPress={onCancel}>
                Volver
              </Button>
            </div>
          </div>
        )}
      </Card.Content>
    </Card>
  );
}

/**
 * Mis sesiones del estudiante (SCRUM-23).
 *
 * Reune las reservas creadas en todos los flujos y permite cancelarlas. La
 * politica la valida la API: esta pantalla muestra el plazo calculado en
 * `cancellationPolicy` y, si la regla ya vencio, conserva la reserva cuando el
 * servidor rechaza la cancelacion.
 */
export function StudentBookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<FriendlyError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [openId, setOpenId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<FriendlyError | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setListError(null);

    try {
      const result = await getMyBookings({ limit: 50 });
      setBookings(result.items);
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'SESSION_EXPIRED') return;
      setListError(toFriendlyError(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const now = Date.now();
  const upcoming = useMemo(
    () =>
      bookings
        .filter(
          (booking) =>
            ACTIVE_STATUSES.includes(booking.status) &&
            new Date(booking.startAt).getTime() > now,
        )
        .sort(
          (first, second) =>
            new Date(first.startAt).getTime() - new Date(second.startAt).getTime(),
        ),
    [bookings, now],
  );
  const past = useMemo(
    () =>
      bookings
        .filter(
          (booking) =>
            !ACTIVE_STATUSES.includes(booking.status) ||
            new Date(booking.startAt).getTime() <= now,
        )
        .sort(
          (first, second) =>
            new Date(second.startAt).getTime() - new Date(first.startAt).getTime(),
        ),
    [bookings, now],
  );

  const counts = useMemo(
    () => ({
      upcoming: upcoming.length,
      completed: bookings.filter((booking) => booking.status === 'COMPLETED').length,
      cancelled: bookings.filter(
        (booking) => booking.status === 'CANCELLED' || booking.status === 'REJECTED',
      ).length,
    }),
    [bookings, upcoming.length],
  );

  function openCancel(booking: Booking) {
    setNotice(null);
    setActionError(null);
    setReason('');
    setOpenId(booking.id);
  }

  function closeCancel() {
    setOpenId(null);
    setReason('');
    setActionError(null);
  }

  async function handleCancel(booking: Booking) {
    setSaving(true);
    setActionError(null);
    setNotice(null);

    try {
      const result = await cancelBooking(booking.id, reason);
      setBookings((current) =>
        current.map((item) => (item.id === booking.id ? result.booking : item)),
      );
      setNotice(
        result.message ||
          'Reserva cancelada. Si existía un pago simulado aprobado, quedó marcado como reembolsado.',
      );
      closeCancel();
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'SESSION_EXPIRED') return;
      setActionError(toFriendlyError(caught));
    } finally {
      setSaving(false);
    }
  }

  function renderList(items: Booking[]) {
    return (
      <ul className="flex flex-col gap-4">
        {items.map((booking) => (
          <li key={booking.id}>
            <BookingCard
              booking={booking}
              open={openId === booking.id}
              saving={saving}
              reason={openId === booking.id ? reason : ''}
              actionError={openId === booking.id ? actionError : null}
              onOpen={() => openCancel(booking)}
              onReasonChange={setReason}
              onCancel={closeCancel}
              onConfirm={() => void handleCancel(booking)}
            />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <section className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-accent">
            <CalendarBlankIcon aria-hidden="true" size={24} weight="fill" />
            <span className="text-sm font-semibold">Reservas</span>
          </div>
          <h1 className="text-2xl font-bold text-balance text-foreground sm:text-3xl">
            Mis sesiones
          </h1>
          <p className="max-w-2xl text-sm text-muted sm:text-base">
            Consulta la fecha, el tutor, la materia, el estado y la tarifa de cada reserva, y
            cancela las que todavía admiten cancelación.
          </p>
        </div>
        <div
          className="grid grid-cols-3 gap-2 sm:gap-3 lg:w-auto lg:shrink-0"
          aria-label="Resumen de tus sesiones"
        >
          <StatTile value={counts.upcoming} label="Próximas" accent />
          <StatTile value={counts.completed} label="Completadas" />
          <StatTile value={counts.cancelled} label="Canceladas" />
        </div>
      </section>

      {notice && <FormNotice>{notice}</FormNotice>}
      {listError && <LoadError error={listError} onRetry={() => void load()} />}

      {loading && (
        <div className="flex flex-col gap-4" aria-live="polite" aria-busy="true">
          <span className="sr-only">Cargando tus reservas...</span>
          <div className="h-40 animate-pulse rounded-xl bg-default" />
          <div className="h-40 animate-pulse rounded-xl bg-default" />
        </div>
      )}

      {!loading && !listError && bookings.length === 0 && (
        <Card>
          <Card.Content className="flex flex-col items-center gap-2 py-12 text-center">
            <CalendarBlankIcon aria-hidden="true" className="text-muted" size={32} />
            <h2 className="text-lg font-bold text-foreground">Todavía no tienes reservas</h2>
            <p className="max-w-md text-sm text-muted">
              Cuando reserves una tutoría aparecerá aquí con su fecha, estado y tarifa.
            </p>
          </Card.Content>
        </Card>
      )}

      {!loading && !listError && upcoming.length > 0 && (
        <section className="flex flex-col gap-4" aria-labelledby="student-upcoming-title">
          <div className="flex items-center gap-2">
            <h2 id="student-upcoming-title" className="text-lg font-bold text-foreground">
              Próximas
            </h2>
            <Chip size="sm" variant="soft" color="accent">
              {upcoming.length}
            </Chip>
          </div>
          {renderList(upcoming)}
        </section>
      )}

      {!loading && !listError && past.length > 0 && (
        <section className="flex flex-col gap-4" aria-labelledby="student-past-title">
          <div className="flex items-center gap-2">
            <h2 id="student-past-title" className="text-lg font-bold text-foreground">
              Historial
            </h2>
            <Chip size="sm" variant="soft">
              {past.length}
            </Chip>
          </div>
          {renderList(past)}
        </section>
      )}
    </main>
  );
}
