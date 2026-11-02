import { useState } from 'react';

interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  readOnly?: boolean;
  size?: 'sm' | 'lg';
  label?: string;
}

const LABELS = ['Muy mala', 'Mala', 'Regular', 'Buena', 'Excelente'];

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3.1-5.8 3.1 1.1-6.5L2.6 9.4l6.5-.9L12 2.6z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function StarRating({
  value,
  onChange,
  readOnly = false,
  size = 'sm',
  label = 'Calificación',
}: StarRatingProps) {
  const [hovered, setHovered] = useState(0);
  const visibleValue = readOnly ? value : hovered || value;

  return (
    <div
      className={`stars stars--${size}${readOnly ? ' stars--readonly' : ''}`}
      role={readOnly ? 'img' : 'radiogroup'}
      aria-label={
        readOnly && value
          ? `${label}: ${value} de 5 estrellas (${LABELS[value - 1]})`
          : label
      }
      onMouseLeave={() => setHovered(0)}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const active = star <= visibleValue;
        const description = `${star} ${star === 1 ? 'estrella' : 'estrellas'} - ${LABELS[star - 1]}`;

        if (readOnly) {
          return (
            <span key={star} className={`star${active ? ' star--active' : ''}`}>
              <StarIcon filled={active} />
            </span>
          );
        }

        return (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={description}
            title={description}
            className={`star star--button${active ? ' star--active' : ''}`}
            onMouseEnter={() => setHovered(star)}
            onFocus={() => setHovered(star)}
            onBlur={() => setHovered(0)}
            onClick={() => onChange?.(star)}
          >
            <StarIcon filled={active} />
          </button>
        );
      })}
    </div>
  );
}

export { LABELS as RATING_LABELS };
