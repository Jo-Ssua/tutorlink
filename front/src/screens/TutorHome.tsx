import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError, getTutorBookings } from '../api';
import { useAuth } from '../auth/AuthContext';
import { toFriendlyError, type FriendlyError } from '../errors';
import type { Booking, BookingStatus } from '../types';

const dateTimeFormatter = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const copFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

const STATUS_LABEL: Record<BookingStatus, string> = {
  PENDING: 'Por responder',
  ACCEPTED: 'Esperando pago',
  CONFIRMED: 'Confirmada',
  COMPLETED: 'Completada',
  REJECTED: 'Rechazada',
  CANCELLED: 'Cancelada',
};

/**
 * Pantalla inicial del tutor. Antes el rol TUTOR se quedaba sin destino tras
 * iniciar sesión: caía en un panel de "solo para estudiantes".
 *
 * Es de solo lectura. Aceptar, rechazar y completar reservas siguen estando en
 * la API y se expondrán en la pantalla del tutor que aún no existe.
 */
export function TutorHome() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FriendlyError | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await getTutorBookings();
      setBookings(result.items);
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'SESSION_EXPIRED') {
        return;
      }
      setError(toFriendlyError(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const upcoming = bookings.filter(
      (booking) =>
        (booking.status === 'CONFIRMED' || booking.status === 'ACCEPTED') &&
        new Date(booking.startAt) > new Date(),
    ).length;

    return {
      pending: bookings.filter((booking) => booking.status === 'PENDING').length,
      upcoming,
      completed: bookings.filter((booking) => booking.status === 'COMPLETED').length,
    };
  }, [bookings]);

  return (
    <main className="dashboard">
      <section className="hero">
        <div>
          <p className="eyebrow">Panel del tutor</p>
          <h1>Hola, {user?.fullName.split(/\s+/)[0]}</h1>
          <p className="hero__text">
            Estas son las reservas que han hecho sobre tus horarios. El nombre del estudiante
            llega anonimizado hasta que la sesión se confirma.
          </p>
        </div>
        <div className="stats" aria-label="Resumen de reservas">
          <div className="stat stat--pending">
            <span className="stat__value">{counts.pending}</span>
            <span className="stat__label">Por responder</span>
          </div>
          <div className="stat">
            <span className="stat__value">{counts.upcoming}</span>
            <span className="stat__label">Próximas</span>
          </div>
          <div className="stat">
            <span className="stat__value">{counts.completed}</span>
            <span className="stat__label">Completadas</span>
          </div>
        </div>
      </section>

      {error && (
        <div className="alert alert--error" role="alert">
          <p>{error.message}</p>
          <button
            type="button"
            className="button button--ghost button--small"
            onClick={() => void load()}
          >
            Reintentar
          </button>
        </div>
      )}

      {loading && (
        <div className="skeleton-list" aria-live="polite" aria-busy="true">
          <span className="sr-only">Cargando reservas...</span>
          <div className="skeleton" />
          <div className="skeleton" />
        </div>
      )}

      {!loading && !error && bookings.length === 0 && (
        <section className="panel panel--center">
          <h2>Todavía no tienes reservas</h2>
          <p>
            Cuando alguien reserve uno de tus horarios aparecerá aquí. Publica tu
            disponibilidad desde <code>POST /tutor/availability</code> mientras la pantalla de
            agenda esté en construcción.
          </p>
        </section>
      )}

      {!loading && bookings.length > 0 && (
        <section className="section" aria-labelledby="tutor-bookings-title">
          <div className="section__heading">
            <h2 id="tutor-bookings-title">Reservas recibidas</h2>
            <span className="count">{bookings.length}</span>
          </div>

          <div className="session-list">
            {bookings.map((booking) => (
              <article key={booking.id} className="session-card">
                <header className="session-card__header">
                  <div>
                    <p className="session-card__eyebrow">
                      {booking.subject.code} · {booking.subject.name}
                    </p>
                    <h3 className="session-card__topic">{booking.topic}</h3>
                  </div>
                  <span className={`pill ${pillClass(booking.status)}`}>
                    {STATUS_LABEL[booking.status]}
                  </span>
                </header>

                <dl className="session-meta">
                  <div>
                    <dt>Cuándo</dt>
                    <dd>{dateTimeFormatter.format(new Date(booking.startAt))}</dd>
                  </div>
                  <div>
                    <dt>Estudiante</dt>
                    <dd>{booking.student?.alias ?? 'Anónimo'}</dd>
                  </div>
                  <div>
                    <dt>Tus ingresos</dt>
                    <dd>{copFormatter.format(booking.price.subtotal - booking.price.platformFee)}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function pillClass(status: BookingStatus): string {
  if (status === 'PENDING' || status === 'ACCEPTED') return 'pill--pending';
  if (status === 'COMPLETED' || status === 'CONFIRMED') return 'pill--done';
  return '';
}
