import { Button, Card, Chip } from '@heroui/react';
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

const reviewDateFormatter = new Intl.DateTimeFormat('es-CO', { dateStyle: 'long' });

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** Un dato de la ficha: etiqueta arriba, valor abajo, legible en una columna. */
function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</dt>
      <dd className="text-sm text-foreground">{children}</dd>
    </div>
  );
}

export function SessionCard({ booking, onSubmitReview }: SessionCardProps) {
  const [editing, setEditing] = useState(false);
  const tutorName = booking.tutor?.fullName ?? 'Tutor';
  const isCompleted = booking.status === 'COMPLETED';
  const alreadyReviewed = Boolean(booking.review);
  const canRate = isCompleted && !alreadyReviewed;
  const startAt = new Date(booking.startAt);

  return (
    <Card>
      <Card.Header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Chip size="sm" variant="soft" color="accent">
              {booking.subject.code}
            </Chip>
            <Chip size="sm" variant="soft" color={canRate ? 'warning' : 'success'}>
              {alreadyReviewed
                ? 'Calificada'
                : isCompleted
                  ? 'Pendiente por calificar'
                  : booking.status}
            </Chip>
          </div>
          <Card.Title>{booking.subject.name}</Card.Title>
          <Card.Description>{booking.topic}</Card.Description>
        </div>

        <div className="flex flex-col gap-1 sm:items-end">
          <StarRating
            value={Math.round(booking.tutor?.averageRating ?? 0)}
            readOnly
            label="Promedio del tutor"
          />
          <span className="text-xs text-muted">
            {booking.tutor?.reviewCount
              ? `${booking.tutor.averageRating?.toFixed(1)} · ${booking.tutor.reviewCount} ${
                  booking.tutor.reviewCount === 1 ? 'reseña' : 'reseñas'
                }`
              : 'Sin calificaciones aún'}
          </span>
        </div>
      </Card.Header>

      <Card.Content className="flex flex-col gap-4">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Meta label="Tutor">{tutorName}</Meta>
          <Meta label="Fecha">
            <time dateTime={booking.startAt}>
              {dateFormatter.format(startAt)} · {timeFormatter.format(startAt)}
            </time>
          </Meta>
          <Meta label="Duración">{formatDuration(booking.durationMinutes)}</Meta>
          <Meta label="Modalidad">{MODALITY_LABELS[booking.modality] ?? booking.modality}</Meta>
        </dl>

        {alreadyReviewed && booking.review && (
          <section
            className="flex flex-col gap-2 rounded-xl border border-border bg-surface-secondary p-4"
            aria-label="Tu calificación"
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-sm font-semibold text-foreground">Tu calificación</span>
              <StarRating value={booking.review.rating} readOnly label="Tu calificación" />
              <span className="text-sm text-muted tabular-nums">{booking.review.rating}/5</span>
              {booking.review.isAnonymous && (
                <Chip size="sm" variant="soft">
                  Anónima
                </Chip>
              )}
            </div>
            {booking.review.comment ? (
              <p className="text-sm text-foreground italic">“{booking.review.comment}”</p>
            ) : (
              <p className="text-sm text-muted">Enviaste tu calificación sin comentario.</p>
            )}
            {booking.review.createdAt && (
              <p className="text-xs text-muted">
                Enviada el {reviewDateFormatter.format(new Date(booking.review.createdAt))}
              </p>
            )}
          </section>
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
      </Card.Content>

      {canRate && !editing && (
        <Card.Footer className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">
            Esta sesión ya terminó. Comparte tu experiencia para ayudar a otros estudiantes.
          </p>
          <Button className="w-full sm:w-auto" onPress={() => setEditing(true)}>
            Calificar sesión
          </Button>
        </Card.Footer>
      )}
    </Card>
  );
}
