import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError, createBookingReview, getMyCompletedBookings } from '../api';
import { SessionCard } from '../components/SessionCard';
import { toFriendlyError, type FriendlyError } from '../errors';
import type { Booking, CreateReviewPayload } from '../types';

interface ToastState {
  tone: 'success' | 'error';
  message: string;
}

/**
 * SCRUM-17: calificación posterior a una sesión completada.
 *
 * La sesión caída ya no se maneja aquí: `request()` avisa al `AuthProvider`,
 * que limpia el estado y redirige al login.
 */
export function RatingsScreen() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [listError, setListError] = useState<FriendlyError | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 6000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const loadBookings = useCallback(async (targetPage: number, append: boolean) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setListError(null);

    try {
      const result = await getMyCompletedBookings(targetPage);
      setBookings((current) => (append ? [...current, ...result.items] : result.items));
      setPage(result.pagination.page);
      setHasNextPage(result.pagination.hasNextPage);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'SESSION_EXPIRED') {
        return;
      }
      setListError(toFriendlyError(error));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    void loadBookings(1, false);
  }, [loadBookings]);

  const pending = useMemo(
    () => bookings.filter((booking) => booking.status === 'COMPLETED' && !booking.review),
    [bookings],
  );
  const reviewed = useMemo(
    () => bookings.filter((booking) => booking.status === 'COMPLETED' && booking.review),
    [bookings],
  );

  async function handleSubmitReview(booking: Booking, payload: CreateReviewPayload) {
    try {
      const result = await createBookingReview(booking.id, payload);
      setBookings((current) =>
        current.map((item) =>
          item.id === booking.id
            ? {
                ...item,
                review: {
                  rating: result.review.rating,
                  comment: result.review.comment,
                  createdAt: result.review.createdAt,
                  isAnonymous: result.review.isAnonymous,
                },
                tutor: item.tutor
                  ? {
                      ...item.tutor,
                      averageRating: result.tutorRating.averageRating,
                      reviewCount: result.tutorRating.reviewCount,
                    }
                  : item.tutor,
              }
            : item,
        ),
      );
      setToast({
        tone: 'success',
        message: `${result.message} Promedio actual: ${result.tutorRating.averageRating.toFixed(1)} (${result.tutorRating.reviewCount} ${
          result.tutorRating.reviewCount === 1 ? 'reseña' : 'reseñas'
        }).`,
      });
    } catch (error) {
      if (error instanceof ApiError && error.code === 'REVIEW_ALREADY_EXISTS') {
        setToast({
          tone: 'error',
          message: 'Esta sesión ya fue calificada. Actualizamos la lista para evitar duplicados.',
        });
        void loadBookings(1, false);
      }
      throw error;
    }
  }

  return (
    <main className="dashboard">
      <section className="hero">
        <div>
          <p className="eyebrow">SCRUM-17 · Calificación posterior a una sesión</p>
          <h1>Califica tus tutorías completadas</h1>
          <p className="hero__text">
            Asigna de 1 a 5 estrellas y deja una reseña. Solo aparecen las sesiones marcadas
            como completadas y cada una admite una única calificación.
          </p>
        </div>
        <div className="stats" aria-label="Resumen de sesiones">
          <div className="stat stat--pending">
            <span className="stat__value">{pending.length}</span>
            <span className="stat__label">Por calificar</span>
          </div>
          <div className="stat">
            <span className="stat__value">{reviewed.length}</span>
            <span className="stat__label">Calificadas</span>
          </div>
          <div className="stat">
            <span className="stat__value">{bookings.length}</span>
            <span className="stat__label">Sesiones completadas</span>
          </div>
        </div>
      </section>

      {listError && (
        <div className="alert alert--error" role="alert">
          <p>{listError.message}</p>
          {listError.details.map((detail) => (
            <p key={detail}>{detail}</p>
          ))}
          <button
            type="button"
            className="button button--ghost button--small"
            onClick={() => void loadBookings(1, false)}
          >
            Reintentar
          </button>
        </div>
      )}

      {loading && (
        <div className="skeleton-list" aria-live="polite" aria-busy="true">
          <span className="sr-only">Cargando sesiones completadas...</span>
          <div className="skeleton" />
          <div className="skeleton" />
        </div>
      )}

      {!loading && !listError && bookings.length === 0 && (
        <section className="panel panel--center">
          <h2>Aún no tienes sesiones completadas</h2>
          <p>
            Cuando el tutor marque una de tus reservas como completada, aparecerá aquí para que
            puedas calificarla.
          </p>
        </section>
      )}

      {!loading && pending.length > 0 && (
        <section className="section" aria-labelledby="pending-title">
          <div className="section__heading">
            <h2 id="pending-title">Pendientes por calificar</h2>
            <span className="count">{pending.length}</span>
          </div>
          <div className="session-list">
            {pending.map((booking) => (
              <SessionCard
                key={booking.id}
                booking={booking}
                onSubmitReview={handleSubmitReview}
              />
            ))}
          </div>
        </section>
      )}

      {!loading && reviewed.length > 0 && (
        <section className="section" aria-labelledby="reviewed-title">
          <div className="section__heading">
            <h2 id="reviewed-title">Ya calificadas</h2>
            <span className="count">{reviewed.length}</span>
          </div>
          <div className="session-list">
            {reviewed.map((booking) => (
              <SessionCard
                key={booking.id}
                booking={booking}
                onSubmitReview={handleSubmitReview}
              />
            ))}
          </div>
        </section>
      )}

      {!loading && hasNextPage && (
        <div className="load-more">
          <button
            type="button"
            className="button button--ghost"
            disabled={loadingMore}
            onClick={() => void loadBookings(page + 1, true)}
          >
            {loadingMore ? 'Cargando...' : 'Cargar más sesiones'}
          </button>
        </div>
      )}

      {toast && (
        <div className={`toast toast--${toast.tone}`} role="status">
          <p>{toast.message}</p>
          <button type="button" aria-label="Cerrar aviso" onClick={() => setToast(null)}>
            ×
          </button>
        </div>
      )}
    </main>
  );
}
