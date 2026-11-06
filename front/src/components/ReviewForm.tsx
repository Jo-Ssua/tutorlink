import { Button, Checkbox, Description, Label, TextArea, TextField } from '@heroui/react';
import { useState } from 'react';
import { toFriendlyError, type FriendlyError } from '../errors';
import type { CreateReviewPayload } from '../types';
import { FormError } from './FormFeedback';
import { RATING_LABELS, StarRating } from './StarRating';

interface ReviewFormProps {
  tutorName: string;
  subjectName: string;
  onSubmit: (payload: CreateReviewPayload) => Promise<void>;
  onCancel: () => void;
}

/** El mismo tope que valida el backend en `reviews.dto.ts`. */
const MAX_COMMENT = 2000;

export function ReviewForm({ tutorName, subjectName, onSubmit, onCancel }: ReviewFormProps) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [error, setError] = useState<FriendlyError | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (rating < 1 || rating > 5) {
      setError({
        message: 'La calificación es obligatoria. Selecciona entre 1 y 5 estrellas.',
        details: [],
      });
      return;
    }

    if (comment.length > MAX_COMMENT) {
      setError({
        message: `El comentario no puede superar ${MAX_COMMENT} caracteres.`,
        details: [],
      });
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        rating,
        comment: comment.trim() ? comment.trim() : undefined,
        isAnonymous,
      });
    } catch (submitError) {
      setError(toFriendlyError(submitError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      className="flex flex-col gap-5 rounded-xl border border-border bg-surface-secondary p-4 sm:p-5"
      onSubmit={handleSubmit}
      noValidate
    >
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-bold text-foreground">Califica tu tutoría</h3>
        <p className="text-sm text-muted">
          <strong className="text-foreground">{subjectName}</strong> con{' '}
          <strong className="text-foreground">{tutorName}</strong>
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-foreground">
          Calificación <span className="text-danger">*</span>
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <StarRating
            value={rating}
            onChange={(next) => {
              setRating(next);
              setError(null);
            }}
            size="lg"
            label="Calificación de la sesión"
          />
          <span className="text-sm text-muted" aria-live="polite">
            {rating > 0
              ? `${rating} / 5 · ${RATING_LABELS[rating - 1]}`
              : 'Selecciona 1 a 5 estrellas'}
          </span>
        </div>
        <p className="text-sm text-muted">
          La calificación es obligatoria y no se puede modificar después.
        </p>
      </div>

      <TextField
        fullWidth
        name="comment"
        value={comment}
        onChange={setComment}
        isInvalid={comment.length > MAX_COMMENT}
      >
        <Label>Comentario (opcional)</Label>
        <TextArea
          rows={4}
          maxLength={MAX_COMMENT}
          placeholder="Cuéntanos cómo fue la sesión: claridad, puntualidad, dominio del tema..."
        />
        <Description>
          <span className="flex flex-wrap justify-between gap-2">
            <span>Ayuda a otros estudiantes a elegir con confianza.</span>
            <span className="tabular-nums">
              {comment.length}/{MAX_COMMENT}
            </span>
          </span>
        </Description>
      </TextField>

      <Checkbox name="isAnonymous" isSelected={isAnonymous} onChange={setIsAnonymous}>
        <Checkbox.Content>
          <Checkbox.Control>
            <Checkbox.Indicator />
          </Checkbox.Control>
          Publicar mi reseña como anónima
        </Checkbox.Content>
        <Description>Tu nombre no se mostrará junto al comentario.</Description>
      </Checkbox>

      <FormError error={error} />

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="tertiary" isDisabled={submitting} onPress={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" isDisabled={submitting}>
          {submitting ? 'Enviando...' : 'Enviar calificación'}
        </Button>
      </div>
    </form>
  );
}
