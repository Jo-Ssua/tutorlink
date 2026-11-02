import { useEffect, useMemo, useState } from 'react';

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

const keyOf = (year: number, month: number, day: number) =>
  `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

/**
 * Calendario mensual (semana de lunes a domingo). Solo se pueden elegir los días que
 * tienen al menos una franja disponible; el resto aparece deshabilitado.
 */
export function AvailabilityCalendar({
  countByDay,
  activeDay,
  onSelect,
}: {
  /** Mapa AAAA-MM-DD -> cantidad de franjas disponibles ese día. */
  countByDay: Map<string, number>;
  activeDay: string | null;
  onSelect: (dayKey: string) => void;
}) {
  const firstAvailable = useMemo(() => [...countByDay.keys()].sort()[0] ?? null, [countByDay]);
  const lastAvailable = useMemo(() => [...countByDay.keys()].sort().at(-1) ?? null, [countByDay]);

  const seed = activeDay ?? firstAvailable ?? keyOf(new Date().getFullYear(), new Date().getMonth(), 1);
  const [cursor, setCursor] = useState(() => {
    const [year, month] = seed.split('-').map(Number);
    return { year, month: month - 1 };
  });

  // Si el día activo cambia a otro mes (p. ej. el día quedó sin horarios), el calendario lo sigue.
  useEffect(() => {
    if (!activeDay) return;
    const [year, month] = activeDay.split('-').map(Number);
    setCursor((current) =>
      current.year === year && current.month === month - 1 ? current : { year, month: month - 1 },
    );
  }, [activeDay]);

  const monthStartKey = keyOf(cursor.year, cursor.month, 1);
  const nextMonthStartKey =
    cursor.month === 11 ? keyOf(cursor.year + 1, 0, 1) : keyOf(cursor.year, cursor.month + 1, 1);
  const canGoPrev = firstAvailable !== null && firstAvailable < monthStartKey;
  const canGoNext = lastAvailable !== null && lastAvailable >= nextMonthStartKey;

  const first = new Date(cursor.year, cursor.month, 1);
  const leadingBlanks = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();

  const title = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' }).format(first);

  function move(delta: number) {
    const date = new Date(cursor.year, cursor.month + delta, 1);
    setCursor({ year: date.getFullYear(), month: date.getMonth() });
  }

  return (
    <section className="calendar" aria-label="Calendario de disponibilidad">
      <div className="calendar__nav">
        <button type="button" onClick={() => move(-1)} disabled={!canGoPrev} aria-label="Mes anterior">
          ‹
        </button>
        <strong>{title.charAt(0).toUpperCase() + title.slice(1)}</strong>
        <button type="button" onClick={() => move(1)} disabled={!canGoNext} aria-label="Mes siguiente">
          ›
        </button>
      </div>

      <div className="calendar__grid" role="grid">
        {WEEKDAYS.map((label) => (
          <span key={label} className="calendar__weekday" role="columnheader">
            {label}
          </span>
        ))}
        {Array.from({ length: leadingBlanks }, (_, index) => (
          <span key={`blank-${index}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, index) => {
          const day = index + 1;
          const key = keyOf(cursor.year, cursor.month, day);
          const count = countByDay.get(key) ?? 0;
          const selected = key === activeDay;
          return (
            <button
              key={key}
              type="button"
              role="gridcell"
              disabled={count === 0}
              aria-selected={selected}
              aria-label={`${day}, ${count} ${count === 1 ? 'horario disponible' : 'horarios disponibles'}`}
              className={`calendar__day${selected ? ' is-active' : ''}${count > 0 ? ' has-slots' : ''}`}
              onClick={() => onSelect(key)}
            >
              {day}
              {count > 0 && <i aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </section>
  );
}
