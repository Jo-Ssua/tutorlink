import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../api';
import { getAvailability } from './api';
import type { AvailabilitySlot } from './types';

const POLL_MS = 15_000;

export interface AvailabilityChange {
  /** Franjas que existían y dejaron de estar disponibles (reservadas o retiradas). */
  removed: AvailabilitySlot[];
  /** Franjas nuevas (por ejemplo, el tutor actualizó su agenda). */
  added: AvailabilitySlot[];
}

/**
 * Consulta las franjas disponibles de un tutor y las mantiene frescas:
 * refresca cada 15 s, al volver a la pestaña y bajo demanda.
 * Informa qué franjas aparecieron o desaparecieron entre consultas.
 */
export function useAvailability(
  tutorProfileId: string,
  onChange?: (change: AvailabilityChange) => void,
) {
  const [slots, setSlots] = useState<AvailabilitySlot[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const previous = useRef<AvailabilitySlot[] | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const next = await getAvailability(tutorProfileId);
      const before = previous.current;

      if (before) {
        const beforeIds = new Set(before.map((slot) => slot.id));
        const nextIds = new Set(next.map((slot) => slot.id));
        const removed = before.filter((slot) => !nextIds.has(slot.id));
        const added = next.filter((slot) => !beforeIds.has(slot.id));
        if (removed.length > 0 || added.length > 0) {
          onChangeRef.current?.({ removed, added });
        }
      }

      previous.current = next;
      setSlots(next);
      setError(null);
      setUpdatedAt(new Date());
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'No se pudieron cargar los horarios.',
      );
    } finally {
      setRefreshing(false);
    }
  }, [tutorProfileId]);

  useEffect(() => {
    previous.current = null;
    setSlots(null);
    void refresh();

    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [refresh]);

  return { slots, error, refreshing, updatedAt, refresh };
}
