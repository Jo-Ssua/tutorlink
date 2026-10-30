import { useState } from 'react';
import type { Booking, CreateReviewPayload, Modality } from '../types';
import { ReviewForm } from './ReviewForm';
import { StarRating } from './StarRating';

interface SessionCardProps {
  booking: Booking;
  onSubmitReview: (booking: Booking, payload: CreateReviewPayload) => Promise<void>;
}

const MODALITY_LABELS: Record<Modality, string> = {
  IN_PERSON: 'Presencial',
  VIRTUAL: 'Virtual',
  HYBRID: 'Híbrida',
};

const dateFormatter = new Intl.DateTimeFormat('es-CO', {
  weekday: 'short',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const timeFormatter = new Intl.DateTimeFormat('es-CO', {
  hour: 'numeric',
  minute: '2-digit',
});

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

export function SessionCard({ booking, onSubmitReview }: SessionCardProps) {
  const [editing, setEditing] = useState(false);
  const tutorName = booking.tutor?.fullName ?? 'Tutor';
  const isCompleted = booking.status === 'COMPLETED';
  const alreadyReviewed = Boolean(booking.review);
  const canRate = isCompleted && !alreadyReviewed;
  const reviewDate = booking.review?.createdAt ?? null;

  return (
    <article className={`session-card${alreadyReviewed ? ' session-card--reviewed' : ''}`}>
      <header className="session-card__header">
        <div>
          <div className="session-card__eyebrow">
            <span className="pill pill--subject">{booking.subject.code}</span>
            <span className={`pill ${canRate ? 'pill--pending' : 'pill--done'}`}>
              {alreadyReviewed ? 'Calificada' : isCompleted ? 'Pendiente por calificar' : booking.status}
            </span>
          </div>
          <h2>{booking.subject.name}</h2>
          <p className="session-card__topic">{booking.topic}</p>
        </div>
        <div className="session-card__rating">
          <StarRating value={booking.tutor?.averageRating ?? 0} readOnly label="Promedio del tutor" />
          <span>
            {booking.tutor?.reviewCount
              ? `${booking.tutor.averageRating?.toFixed(1)} · ${booking.tutor.reviewCount} ${
                  booking.tutor.reviewCount === 1 ? 'reseña' : 'reseñas'
                }`
              : 'Sin calificaciones aún'}
          </span>
        </div>
      </header>

      <dl className="session-meta">
        <div>
          <dt>Tutor</dt>
          <dd>{tutorName}</dd>
        </div>
        <div>
          <dt>Fecha</dt>
          <dd>
            <time dateTime={booking.startAt}>
              {dateFormatter.format(new Date(booking.startAt))} ·{' '}
              {timeFormatter.format(new Date(booking.startAt))}
            </time>
          </dd>
        </div>
        <div>
          <dt>Duración</dt>
          <dd>{formatDuration(booking.durationMinutes)}</dd>
        </div>
        <div>
          <dt>Modalidad</dt>
          <dd>{MODALITY_LABELS[booking.modality] ?? booking.modality}</dd>
        </div>
      </dl>

      {alreadyReviewed && booking.review && (
        <section className="my-review" aria-label="Tu calificación">
          <div className="my-review__top">
            <span className="my-review__label">Tu calificación</span>
            <StarRating value={booking.review.rating} readOnly />
            <span className="my-review__score">{booking.review.rating}/5</span>
            {booking.review.isAnonymous && <span className="pill pill--anon">Anónima</span>}
          </div>
          {booking.review.comment ? (
            <p className="my-review__comment">“{booking.review.comment}”</p>
          ) : (
            <p className="my-review__comment my-review__comment--empty">
              Enviaste tu calificación sin comentario.
            </p>
          )}
          {reviewDate && (
            <p className="my-review__date">
              Enviada el{' '}
              {new Intl.DateTimeFormat('es-CO', { dateStyle: 'long' }).format(
                new Date(reviewDate),
              )}
            </p>
          )}
        </section>
      )}

      {!isCompleted && (
        <p className="notice notice--blocked" role="status">
          Solo puedes calificar sesiones completadas. Esta sesión está en estado{' '}
          <strong>{booking.status}</strong>, por lo que la acción está bloqueada.
        </p>
      )}

      {canRate && !editing && (
        <div className="session-card__footer">
          <p>Esta sesión ya terminó. Comparte tu experiencia para ayudar a otros estudiantes.</p>
          <button type="button" className="button button--primary" onClick={() => setEditing(true)}>
            Calificar sesión
          </button>
        </div>
      )}

      {canRate && editing && (
        <ReviewForm
          tutorName={tutorName}
          subjectName={booking.subject.name}
          onSubmit={async (payload) => {
            await onSubmitReview(booking, payload);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      )}
    </article>
  );
}
