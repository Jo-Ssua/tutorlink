import { useId, useState } from 'react';
import type { CreateReviewPayload } from '../types';
import { toFriendlyError, type FriendlyError } from '../errors';
import { RATING_LABELS, StarRating } from './StarRating';

interface ReviewFormProps {
  tutorName: string;
  subjectName: string;
  onSubmit: (payload: CreateReviewPayload) => Promise<void>;
  onCancel: () => void;
}

const MAX_COMMENT = 2000;

export function ReviewForm({
  tutorName,
  subjectName,
  onSubmit,
  onCancel,
}: ReviewFormProps) {
  const fieldId = useId();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [fieldError, setFieldError] = useState('');
  const [submitError, setSubmitError] = useState<FriendlyError | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);

    if (rating < 1 || rating > 5) {
      setFieldError('La calificación es obligatoria. Selecciona entre 1 y 5 estrellas.');
      return;
    }

    if (comment.length > MAX_COMMENT) {
      setFieldError(`El comentario no puede superar ${MAX_COMMENT} caracteres.`);
      return;
    }

    setFieldError('');
    setSubmitting(true);
    try {
      await onSubmit({
        rating,
        comment: comment.trim() ? comment.trim() : undefined,
        isAnonymous,
      });
    } catch (error) {
      setSubmitError(toFriendlyError(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="review-form" onSubmit={handleSubmit} noValidate>
      <div className="review-form__heading">
        <h3>Califica tu tutoría</h3>
        <p>
          <strong>{subjectName}</strong> con <strong>{tutorName}</strong>
        </p>
      </div>

      <div className="field">
        <span className="field__label" id={`${fieldId}-rating-label`}>
          Calificación <span className="required">*</span>
        </span>
        <div className="rating-row">
          <StarRating
            value={rating}
            onChange={(next) => {
              setRating(next);
              setFieldError('');
            }}
            size="lg"
            label="Calificación de la sesión"
          />
          <span className="rating-word" aria-live="polite">
            {rating > 0 ? `${rating} / 5 · ${RATING_LABELS[rating - 1]}` : 'Selecciona 1 a 5 estrellas'}
          </span>
        </div>
        <p className="field__hint">La calificación es obligatoria y no se puede modificar después.</p>
      </div>

      <div className="field">
        <label className="field__label" htmlFor={`${fieldId}-comment`}>
          Comentario <span className="optional">(opcional)</span>
        </label>
        <textarea
          id={`${fieldId}-comment`}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder="Cuéntanos cómo fue la sesión: claridad, puntualidad, dominio del tema..."
          rows={4}
          maxLength={MAX_COMMENT}
        />
        <div className="field__meta">
          <span className="field__hint">
            Ayuda a otros estudiantes a elegir con confianza.
          </span>
          <span className={comment.length > MAX_COMMENT ? 'counter counter--over' : 'counter'}>
            {comment.length}/{MAX_COMMENT}
          </span>
        </div>
      </div>

      <label className="checkbox">
        <input
          type="checkbox"
          checked={isAnonymous}
          onChange={(event) => setIsAnonymous(event.target.checked)}
        />
        <span>
          Publicar mi reseña como anónima
          <small>Tu nombre no se mostrará junto al comentario.</small>
        </span>
      </label>

      {fieldError && (
        <p className="alert alert--error" role="alert">
          {fieldError}
        </p>
      )}

      {submitError && (
        <div className="alert alert--error" role="alert">
          <p>{submitError.message}</p>
          {submitError.details.length > 0 && (
            <ul>
              {submitError.details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="review-form__actions">
        <button type="button" className="button button--ghost" onClick={onCancel} disabled={submitting}>
          Cancelar
        </button>
        <button type="submit" className="button button--primary" disabled={submitting}>
          {submitting ? 'Enviando...' : 'Enviar calificación'}
        </button>
      </div>
    </form>
  );
}
