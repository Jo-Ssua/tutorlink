import { useCallback, useEffect, useMemo, useState } from 'react';
import { AvailabilityCalendar } from '../components/AvailabilityCalendar';
import { Alert, Avatar, BottomBar, Loading, ScreenHeader } from '../components/ui';
import {
  MODALITY_LABEL,
  dayKey,
  durationMinutes,
  formatCop,
  formatDuration,
  formatLongDate,
  formatTimeRange,
} from '../format';
import { useAvailability, type AvailabilityChange } from '../useAvailability';
import type { AvailabilitySlot, Modality, TutorProfile } from '../types';

type ModalityFilter = 'ALL' | 'VIRTUAL' | 'IN_PERSON';

const FILTERS: Array<{ value: ModalityFilter; label: string }> = [
  { value: 'ALL', label: 'Todas' },
  { value: 'VIRTUAL', label: 'Virtual' },
  { value: 'IN_PERSON', label: 'Presencial' },
];

const matchesFilter = (modality: Modality, filter: ModalityFilter) =>
  filter === 'ALL' || modality === 'HYBRID' || modality === filter;

/**
 * Paso 1 de la reserva: consulta de disponibilidad (SCRUM-20).
 * - Muestra únicamente franjas disponibles (la API ya excluye las reservadas o bloqueadas).
 * - Se refresca sola: si otra persona toma una franja desaparece; si el tutor cambia su agenda
 *   aparecen los nuevos horarios.
 */
export function SlotsScreen({
  tutor,
  initialSlot,
  initialNotice,
  onBack,
  onContinue,
}: {
  tutor: TutorProfile;
  initialSlot: AvailabilitySlot | null;
  initialNotice?: string;
  onBack: () => void;
  onContinue: (slot: AvailabilitySlot) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(initialSlot?.id ?? null);
  const [activeDay, setActiveDay] = useState<string | null>(
    initialSlot ? dayKey(initialSlot.startAt) : null,
  );
  const [filter, setFilter] = useState<ModalityFilter>('ALL');
  const [missing, setMissing] = useState(false);
  const [warning, setWarning] = useState<string | null>(initialNotice ?? null);
  const [info, setInfo] = useState<string | null>(null);

  const handleChange = useCallback(
    ({ removed, added }: AvailabilityChange) => {
      if (selectedId && removed.some((slot) => slot.id === selectedId)) {
        setSelectedId(null);
        setWarning(
          'El horario que habías elegido ya no está disponible porque otra persona lo reservó o el tutor lo retiró. Elige otro.',
        );
      }
      if (added.length > 0) {
        setInfo(
          added.length === 1
            ? 'El tutor actualizó su agenda: hay 1 horario nuevo.'
            : `El tutor actualizó su agenda: hay ${added.length} horarios nuevos.`,
        );
      } else if (removed.length > 0) {
        setInfo('Algunos horarios ya no están disponibles y se retiraron de la lista.');
      }
    },
    [selectedId],
  );

  const { slots, error, refreshing, updatedAt, refresh } = useAvailability(tutor.id, handleChange);

  const visible = useMemo(
    () => (slots ?? []).filter((slot) => matchesFilter(slot.modality, filter)),
    [slots, filter],
  );

  const countByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const slot of visible) {
      const key = dayKey(slot.startAt);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [visible]);

  // Mantiene un día activo válido: el primero con horarios si el actual quedó vacío.
  useEffect(() => {
    if (!slots) return;
    const keys = [...countByDay.keys()].sort();
    if (keys.length === 0) {
      setActiveDay(null);
    } else if (!activeDay || !countByDay.has(activeDay)) {
      setActiveDay(keys[0]);
    }
  }, [slots, countByDay, activeDay]);

  // Quita avisos de información pasados unos segundos.
  useEffect(() => {
    if (!info) return;
    const timer = window.setTimeout(() => setInfo(null), 8000);
    return () => window.clearTimeout(timer);
  }, [info]);

  const daySlots = visible.filter((slot) => dayKey(slot.startAt) === activeDay);
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

      {warning && (
        <Alert title="Horario no disponible">
          <p>{warning}</p>
          <button type="button" className="link-btn" onClick={() => setWarning(null)}>
            Entendido
          </button>
        </Alert>
      )}
      {info && (
        <Alert tone="info">
          <p>{info}</p>
        </Alert>
      )}
      {error && <Alert title="No pudimos cargar los horarios">{error}</Alert>}
      {!slots && !error && <Loading label="Buscando horarios…" />}

      {slots && slots.length === 0 && (
        <Alert tone="info" title="Sin horarios disponibles">
          Este tutor no tiene franjas libres por ahora. Esta pantalla se actualiza sola: si
          publica nuevos horarios los verás aquí.
        </Alert>
      )}

      {slots && slots.length > 0 && (
        <>
          <div className="filters" role="radiogroup" aria-label="Filtrar por modalidad">
            {FILTERS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={filter === option.value}
                className={filter === option.value ? 'is-active' : ''}
                onClick={() => setFilter(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>

          {countByDay.size === 0 ? (
            <Alert tone="info" title="Sin horarios con ese filtro">
              Prueba con otra modalidad.
            </Alert>
          ) : (
            <>
              <AvailabilityCalendar
                countByDay={countByDay}
                activeDay={activeDay}
                onSelect={setActiveDay}
              />

              {activeDay && daySlots[0] && (
                <p className="section-label">
                  Horas disponibles · {formatLongDate(daySlots[0].startAt)}
                </p>
              )}
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
                        setWarning(null);
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

          <p className="freshness">
            {updatedAt
              ? `Actualizado a las ${updatedAt.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
              : ''}{' '}
            <button
              type="button"
              className="link-btn"
              disabled={refreshing}
              onClick={() => void refresh()}
            >
              {refreshing ? 'Actualizando…' : 'Actualizar'}
            </button>
          </p>
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
