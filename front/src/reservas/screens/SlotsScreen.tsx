import { Button, Card, Chip, Radio, RadioGroup } from '@heroui/react';
import { ArrowClockwiseIcon } from '@phosphor-icons/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AvailabilityCalendar } from '../components/AvailabilityCalendar';
import { ActionBar, Avatar, FlowAlert, Loading, ScreenHeader } from '../components/ui';
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
      <ScreenHeader
        onBack={onBack}
        backLabel="Perfil"
        step={{ current: 1, total: 2 }}
        title="Selecciona tu horario"
      />

      <Card>
        <Card.Content className="flex flex-row items-center gap-4">
          <Avatar name={tutor.fullName} />
          <div className="flex min-w-0 flex-col">
            <strong className="text-foreground">{tutor.fullName}</strong>
            <span className="text-sm text-muted">
              {tutor.subjects.map((subject) => subject.name).join(' · ')}
            </span>
          </div>
          <Chip className="ml-auto shrink-0" size="sm" variant="soft" color="accent">
            {formatCop(tutor.hourlyRate)} / h
          </Chip>
        </Card.Content>
      </Card>

      {warning && (
        <FlowAlert
          title="Horario no disponible"
          action={
            <Button size="sm" variant="tertiary" onPress={() => setWarning(null)}>
              Entendido
            </Button>
          }
        >
          {warning}
        </FlowAlert>
      )}
      {info && <FlowAlert status="accent">{info}</FlowAlert>}
      {error && <FlowAlert title="No pudimos cargar los horarios">{error}</FlowAlert>}
      {!slots && !error && <Loading label="Buscando horarios..." />}

      {slots && slots.length === 0 && (
        <FlowAlert status="accent" title="Sin horarios disponibles">
          Este tutor no tiene franjas libres por ahora. Esta pantalla se actualiza sola: si publica
          nuevos horarios los verás aquí.
        </FlowAlert>
      )}

      {slots && slots.length > 0 && (
        <>
          <RadioGroup
            aria-label="Filtrar por modalidad"
            orientation="horizontal"
            value={filter}
            onChange={(value) => setFilter(value as ModalityFilter)}
          >
            {FILTERS.map((option) => (
              <Radio key={option.value} value={option.value}>
                <Radio.Content>
                  <Radio.Control>
                    <Radio.Indicator />
                  </Radio.Control>
                  {option.label}
                </Radio.Content>
              </Radio>
            ))}
          </RadioGroup>

          {countByDay.size === 0 ? (
            <FlowAlert status="accent" title="Sin horarios con ese filtro">
              Prueba con otra modalidad.
            </FlowAlert>
          ) : (
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
              <AvailabilityCalendar
                countByDay={countByDay}
                activeDay={activeDay}
                onSelect={setActiveDay}
              />

              <div className="flex min-w-0 flex-1 flex-col gap-2">
                {activeDay && daySlots[0] && (
                  <p className="text-xs font-semibold tracking-wide text-muted uppercase">
                    Horas disponibles · {formatLongDate(daySlots[0].startAt)}
                  </p>
                )}
                <RadioGroup
                  aria-label="Horas disponibles"
                  value={selectedId ?? ''}
                  onChange={(value) => {
                    setSelectedId(value);
                    setMissing(false);
                    setWarning(null);
                  }}
                >
                  {daySlots.map((slot) => (
                    <Radio
                      key={slot.id}
                      value={slot.id}
                      className="rounded-xl border border-border bg-surface p-3"
                    >
                      <Radio.Content>
                        <Radio.Control>
                          <Radio.Indicator />
                        </Radio.Control>
                        <span className="flex flex-col gap-0.5">
                          <strong className="text-foreground">
                            {formatTimeRange(slot.startAt, slot.endAt)}
                          </strong>
                          <small className="text-muted">
                            Duración: {formatDuration(durationMinutes(slot.startAt, slot.endAt))} ·{' '}
                            {MODALITY_LABEL[slot.modality]}
                          </small>
                        </span>
                      </Radio.Content>
                    </Radio>
                  ))}
                </RadioGroup>
              </div>
            </div>
          )}

          <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
            {updatedAt
              ? `Actualizado a las ${updatedAt.toLocaleTimeString('es-CO', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}`
              : ''}
            <Button
              size="sm"
              variant="tertiary"
              isDisabled={refreshing}
              onPress={() => void refresh()}
            >
              <ArrowClockwiseIcon aria-hidden="true" />
              {refreshing ? 'Actualizando...' : 'Actualizar'}
            </Button>
          </p>
        </>
      )}

      {missing && (
        <FlowAlert title="Falta elegir un horario">
          Selecciona una franja disponible para continuar.
        </FlowAlert>
      )}

      <ActionBar
        aside={
          estimated !== null && selected ? (
            <span className="flex flex-col">
              <span className="text-xs tracking-wide uppercase">Valor estimado</span>
              <span className="text-foreground">
                Sesión de {formatDuration(durationMinutes(selected.startAt, selected.endAt))} ·{' '}
                <strong className="tabular-nums">{formatCop(estimated)} COP</strong>
              </span>
            </span>
          ) : null
        }
      >
        <Button onPress={handleContinue}>Continuar</Button>
      </ActionBar>
    </>
  );
}
