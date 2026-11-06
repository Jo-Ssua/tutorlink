import { StarIcon } from '@phosphor-icons/react';
import { useRef, useState } from 'react';

interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  readOnly?: boolean;
  size?: 'sm' | 'lg';
  label?: string;
}

const LABELS = ['Muy mala', 'Mala', 'Regular', 'Buena', 'Excelente'];
const PIXEL_SIZE = { sm: 20, lg: 40 } as const;

/** Un paso a la derecha o a la izquierda según la tecla, o 0 si no mueve. */
const STEP: Record<string, number> = {
  ArrowRight: 1,
  ArrowUp: 1,
  ArrowLeft: -1,
  ArrowDown: -1,
};

export function StarRating({
  value,
  onChange,
  readOnly = false,
  size = 'sm',
  label = 'Calificación',
}: StarRatingProps) {
  const [hovered, setHovered] = useState(0);
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const pixels = PIXEL_SIZE[size];

  if (readOnly) {
    return (
      <div
        role="img"
        aria-label={value ? `${label}: ${value} de 5 estrellas (${LABELS[value - 1]})` : label}
        className="flex items-center gap-0.5"
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <StarIcon
            key={star}
            size={pixels}
            weight={star <= value ? 'fill' : 'regular'}
            className={star <= value ? 'text-warning' : 'text-muted'}
          />
        ))}
      </div>
    );
  }

  // Sin selección el foco entra por la primera estrella; con selección, por la
  // elegida. Así el grupo ocupa una sola parada de tabulación, como un radio.
  const focusable = value || 1;
  const visibleValue = hovered || value;

  function pick(star: number) {
    onChange?.(star);
    buttons.current[star - 1]?.focus();
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    const step = STEP[event.key];

    if (step) {
      event.preventDefault();
      pick(Math.min(5, Math.max(1, (value || 1) + step)));
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      pick(1);
    } else if (event.key === 'End') {
      event.preventDefault();
      pick(5);
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex items-center gap-1"
      onMouseLeave={() => setHovered(0)}
      onKeyDown={handleKeyDown}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const active = star <= visibleValue;
        const description = `${star} ${star === 1 ? 'estrella' : 'estrellas'} - ${LABELS[star - 1]}`;

        return (
          <button
            key={star}
            ref={(node) => {
              buttons.current[star - 1] = node;
            }}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={description}
            title={description}
            tabIndex={star === focusable ? 0 : -1}
            className={`grid size-11 cursor-pointer place-items-center rounded-lg transition-colors hover:bg-default ${
              active ? 'text-warning' : 'text-muted'
            }`}
            onMouseEnter={() => setHovered(star)}
            onFocus={() => setHovered(star)}
            onBlur={() => setHovered(0)}
            onClick={() => onChange?.(star)}
          >
            <StarIcon size={pixels} weight={active ? 'fill' : 'regular'} />
          </button>
        );
      })}
    </div>
  );
}

export { LABELS as RATING_LABELS };
