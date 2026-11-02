import { useEffect, useMemo, useState } from 'react';
import { ReservasApiError, getAvailability } from '../api';
import { Alert, Avatar, BottomBar, Loading, ScreenHeader } from '../components/ui';
import {
  MODALITY_LABEL,
  dayKey,
  durationMinutes,
  formatCop,
  formatDuration,
  formatMonthYear,
  formatShortDay,
  formatTimeRange,
} from '../format';
import type { AvailabilitySlot, TutorProfile } from '../types';

/**
 * Paso 1: elegir una franja disponible.
 * Versión base para SCRUM-21; el refinamiento (calendario, refresco y bloqueos) es SCRUM-20.
 */
export function SlotsScreen({
  tutor,
  initialSlot,
  onBack,
  onContinue,
}: {
  tutor: TutorProfile;
  initialSlot: AvailabilitySlot | null;
  onBack: () => void;
  onContinue: (slot: AvailabilitySlot) => void;
}) {
  const [slots, setSlots] = useState<AvailabilitySlot[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(initialSlot?.id ?? null);
  const [activeDay, setActiveDay] = useState<string | null>(
    initialSlot ? dayKey(initialSlot.startAt) : null,
  );
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    getAvailability(tutor.id)
      .then((result) => {
        setSlots(result);
        setActiveDay((current) => current ?? (result[0] ? dayKey(result[0].startAt) : null));
      })
      .catch((caught: unknown) =>
        setError(
          caught instanceof ReservasApiError ? caught.message : 'No se pudieron cargar los horarios.',
        ),
      );
  }, [tutor.id]);

  const days = useMemo(() => {
    const map = new Map<string, AvailabilitySlot[]>();
    for (const slot of slots ?? []) {
      const key = dayKey(slot.startAt);
      map.set(key, [...(map.get(key) ?? []), slot]);
    }
    return [...map.entries()];
  }, [slots]);

  const daySlots = days.find(([key]) => key === activeDay)?.[1] ?? [];
  const selected = slots?.find((slot) => slot.id === selectedId) ?? null;
  const estimated = selected
    ? (tutor.hourlyRate * durationMinutes(selected.startAt, selected.endAt)) / 60
    : null;

  function handleContinue() {
    if (!selected) {
      setMissing(true);
      return;
    }
    onContinue(selected);
  }

  return (
    <>
      <ScreenHeader onBack={onBack} step="Paso 1 de 2 · Reserva" title="Selecciona tu horario" />

      <section className="card tutor-strip">
        <Avatar name={tutor.fullName} />
        <div>
          <strong>{tutor.fullName}</strong>
          <span className="r-muted">{tutor.subjects.map((s) => s.name).join(' · ')}</span>
        </div>
        <span className="price">{formatCop(tutor.hourlyRate)} / h</span>
      </section>

      {error && <Alert title="No pudimos cargar los horarios">{error}</Alert>}
      {!slots && !error && <Loading label="Buscando horarios…" />}

      {slots && days.length === 0 && (
        <Alert tone="info" title="Sin horarios disponibles">
          Este tutor no tiene franjas libres por ahora. Vuelve más tarde o elige otro tutor.
        </Alert>
      )}

      {days.length > 0 && (
        <>
          <p className="section-label">{formatMonthYear(days[0][1][0].startAt)}</p>
          <div className="day-strip" role="tablist" aria-label="Días con horarios">
            {days.map(([key, items]) => {
              const { weekday, day } = formatShortDay(items[0].startAt);
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={key === activeDay}
                  className={`day-chip${key === activeDay ? ' is-active' : ''}`}
                  onClick={() => setActiveDay(key)}
                >
                  <span>{weekday}</span>
                  <strong>{day}</strong>
                </button>
              );
            })}
          </div>

          <p className="section-label">Horas disponibles</p>
          <div className="slot-list" role="radiogroup" aria-label="Horas disponibles">
            {daySlots.map((slot) => {
              const checked = slot.id === selectedId;
              return (
                <button
                  key={slot.id}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  className={`slot${checked ? ' is-selected' : ''}`}
                  onClick={() => {
                    setSelectedId(slot.id);
                    setMissing(false);
                  }}
                >
                  <span>
                    <strong>{formatTimeRange(slot.startAt, slot.endAt)}</strong>
                    <small>
                      Duración: {formatDuration(durationMinutes(slot.startAt, slot.endAt))} ·{' '}
                      {MODALITY_LABEL[slot.modality]}
                    </small>
                  </span>
                  <span className="radio" aria-hidden="true" />
                </button>
              );
            })}
          </div>
        </>
      )}

      {missing && (
        <Alert title="Falta elegir un horario">
          Selecciona una franja disponible para continuar.
        </Alert>
      )}

      <BottomBar>
        {estimated !== null && selected && (
          <div className="estimate">
            <span>
              <small>Valor estimado</small>
              Sesión de {formatDuration(durationMinutes(selected.startAt, selected.endAt))}
            </span>
            <strong>{formatCop(estimated)} COP</strong>
          </div>
        )}
        <button type="button" className="btn btn--primary" onClick={handleContinue}>
          Continuar
        </button>
      </BottomBar>
    </>
  );
}
