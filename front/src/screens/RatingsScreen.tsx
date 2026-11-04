import { Alert, Button, Card, Chip } from '@heroui/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError, createBookingReview, getMyCompletedBookings } from '../api';
import { SessionCard } from '../components/SessionCard';
import { toFriendlyError, type FriendlyError } from '../errors';
import type { Booking, CreateReviewPayload } from '../types';

interface ToastState {
  tone: 'success' | 'error';
  message: string;
}

/** Una cifra del resumen; en móvil las tres caben en una fila. */
function Stat({ value, label, accent = false }: { value: number; label: string; accent?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-border bg-surface p-3 text-center sm:items-start sm:p-4 sm:text-left">
      <span
        className={`text-2xl font-bold tabular-nums sm:text-3xl ${
          accent ? 'text-accent' : 'text-foreground'
        }`}
      >
        {value}
      </span>
      <span className="text-xs text-muted sm:text-sm">{label}</span>
    </div>
  );
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
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <section className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold text-balance text-foreground sm:text-3xl">
            Califica tus tutorías completadas
          </h1>
          <p className="max-w-2xl text-sm text-muted sm:text-base">
            Asigna de 1 a 5 estrellas y deja una reseña. Solo aparecen las sesiones marcadas como
            completadas y cada una admite una única calificación.
          </p>
        </div>
        <div
          className="grid grid-cols-3 gap-2 sm:gap-3 lg:w-auto lg:shrink-0"
          aria-label="Resumen de sesiones"
        >
          <Stat value={pending.length} label="Por calificar" accent />
          <Stat value={reviewed.length} label="Calificadas" />
          <Stat value={bookings.length} label="Completadas" />
        </div>
      </section>

      {listError && (
        <Alert status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{listError.message}</Alert.Title>
            {listError.details.length > 0 && (
              <Alert.Description>
                <ul className="mt-1 list-inside list-disc space-y-1">
                  {listError.details.map((detail) => (
                    <li key={detail}>{detail}</li>
                  ))}
                </ul>
              </Alert.Description>
            )}
          </Alert.Content>
          <Button size="sm" variant="tertiary" onPress={() => void loadBookings(1, false)}>
            Reintentar
          </Button>
        </Alert>
      )}

      {loading && (
        <div className="flex flex-col gap-4" aria-live="polite" aria-busy="true">
          <span className="sr-only">Cargando sesiones completadas...</span>
          <div className="h-40 animate-pulse rounded-xl bg-default" />
          <div className="h-40 animate-pulse rounded-xl bg-default" />
        </div>
      )}

      {!loading && !listError && bookings.length === 0 && (
        <Card>
          <Card.Content className="flex flex-col items-center gap-2 py-10 text-center">
            <h2 className="text-lg font-bold text-foreground">Aún no tienes sesiones completadas</h2>
            <p className="max-w-md text-sm text-muted">
              Cuando el tutor marque una de tus reservas como completada, aparecerá aquí para que
              puedas calificarla.
            </p>
          </Card.Content>
        </Card>
      )}

      {!loading && pending.length > 0 && (
        <section className="flex flex-col gap-4" aria-labelledby="pending-title">
          <div className="flex items-center gap-2">
            <h2 id="pending-title" className="text-lg font-bold text-foreground">
              Pendientes por calificar
            </h2>
            <Chip size="sm" variant="soft" color="warning">
              {pending.length}
            </Chip>
          </div>
          <div className="flex flex-col gap-4">
            {pending.map((booking) => (
              <SessionCard key={booking.id} booking={booking} onSubmitReview={handleSubmitReview} />
            ))}
          </div>
        </section>
      )}

      {!loading && reviewed.length > 0 && (
        <section className="flex flex-col gap-4" aria-labelledby="reviewed-title">
          <div className="flex items-center gap-2">
            <h2 id="reviewed-title" className="text-lg font-bold text-foreground">
              Ya calificadas
            </h2>
            <Chip size="sm" variant="soft" color="success">
              {reviewed.length}
            </Chip>
          </div>
          <div className="flex flex-col gap-4">
            {reviewed.map((booking) => (
              <SessionCard key={booking.id} booking={booking} onSubmitReview={handleSubmitReview} />
            ))}
          </div>
        </section>
      )}

      {!loading && hasNextPage && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            isDisabled={loadingMore}
            onPress={() => void loadBookings(page + 1, true)}
          >
            {loadingMore ? 'Cargando...' : 'Cargar más sesiones'}
          </Button>
        </div>
      )}

      {toast && (
        /* Por encima de las pestañas inferiores en móvil, abajo a la derecha en escritorio. */
        <div role="status" className="fixed inset-x-4 bottom-24 z-50 mx-auto max-w-md lg:bottom-6">
          <Alert status={toast.tone === 'success' ? 'success' : 'danger'}>
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>{toast.message}</Alert.Title>
            </Alert.Content>
            <Button
              size="sm"
              variant="tertiary"
              aria-label="Cerrar aviso"
              onPress={() => setToast(null)}
            >
              Cerrar
            </Button>
          </Alert>
        </div>
      )}
    </main>
  );
}
