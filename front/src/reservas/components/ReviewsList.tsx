import { useCallback, useEffect, useState } from 'react';
import { StarRating } from '../../components/StarRating';
import { ReservasApiError, getTutorReviews } from '../api';
import { Alert, Loading } from './ui';
import { formatLongDate } from '../format';
import type { Pagination, TutorReview } from '../types';

const PAGE_SIZE = 5;

interface ReviewsListProps {
  tutorId: string;
  hasReviews: boolean;
  averageRating: number;
  reviewCount: number;
}

/** Reseñas verificadas del perfil del tutor (SCRUM-18). */
export function ReviewsList({
  tutorId,
  hasReviews: hasReviewsProp,
  averageRating,
  reviewCount,
}: ReviewsListProps) {
  const [items, setItems] = useState<TutorReview[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [hasReviews, setHasReviews] = useState(hasReviewsProp);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (targetPage: number, append: boolean) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const result = await getTutorReviews(tutorId, targetPage, PAGE_SIZE);
        setItems((current) => (append ? [...current, ...result.items] : result.items));
        setPagination(result.pagination);
        setHasReviews(result.hasReviews);
        setMessage(result.message);
      } catch (caught) {
        setError(
          caught instanceof ReservasApiError
            ? caught.message
            : 'No pudimos cargar las reseñas del tutor.',
        );
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [tutorId],
  );

  useEffect(() => {
    void load(1, false);
  }, [load]);

  return (
    <section className="card reviews" aria-labelledby="reviews-title">
      <div className="reviews__head">
        <div>
          <p className="section-label">Reseñas verificadas</p>
          <h3 id="reviews-title">Opiniones de estudiantes</h3>
        </div>
        {hasReviews && reviewCount > 0 && (
          <span
            className="reviews__summary"
            aria-label={`${averageRating.toFixed(1)} de 5 en ${reviewCount} reseñas`}
          >
            ★ {averageRating.toFixed(1)} · {reviewCount}{' '}
            {reviewCount === 1 ? 'reseña' : 'reseñas'}
          </span>
        )}
      </div>

      <p className="r-muted reviews__note">
        Solo mostramos comentarios vinculados a sesiones completadas en TutorLink. Los datos
        del estudiante no se exponen.
      </p>

      {error && (
        <Alert title="No pudimos cargar las reseñas">
          {error}{' '}
          <button type="button" className="reviews__retry" onClick={() => void load(1, false)}>
            Reintentar
          </button>
        </Alert>
      )}

      {loading && <Loading label="Cargando reseñas verificadas…" />}

      {!loading && !error && items.length === 0 && (
        <div className="reviews__empty" role="status">
          <strong>{message ?? 'Este tutor aún no tiene reseñas verificadas.'}</strong>
          <p>
            Cuando complete una tutoría y reciba una calificación, la reseña aparecerá aquí.
            No generamos promedios ni métricas cuando no existen reseñas.
          </p>
        </div>
      )}

      {!loading && items.length > 0 && (
        <ul className="reviews__list">
          {items.map((review) => (
            <li key={review.id} className="review-item">
              <div className="review-item__top">
                <StarRating
                  value={review.rating}
                  readOnly
                  size="sm"
                  label="Calificación de la sesión"
                />
                <span className="review-item__score">{review.rating}/5</span>
                <span className="review-item__verified">Sesión verificada</span>
              </div>
              <p className="review-item__comment">
                {review.comment
                  ? `“${review.comment}”`
                  : 'El estudiante no dejó comentario.'}
              </p>
              <div className="review-item__meta">
                <span className="chip chip--outline">{review.subjectCode}</span>
                <span>{review.subject}</span>
                <time dateTime={review.createdAt}>{formatLongDate(review.createdAt)}</time>
              </div>
            </li>
          ))}
        </ul>
      )}

      {pagination?.hasNextPage && (
        <button
          type="button"
          className="btn btn--ghost reviews__more"
          disabled={loadingMore}
          onClick={() => void load(pagination.page + 1, true)}
        >
          {loadingMore ? 'Cargando…' : 'Cargar más reseñas'}
        </button>
      )}
    </section>
  );
}
