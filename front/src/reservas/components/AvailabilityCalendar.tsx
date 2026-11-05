import { Calendar, I18nProvider } from '@heroui/react';
import { parseDate, type CalendarDate } from '@internationalized/date';
import { useMemo } from 'react';

/**
 * Calendario mensual de disponibilidad (semana de lunes a domingo).
 *
 * Se apoya en el calendario de HeroUI (React Aria): la rejilla ya trae el
 * teclado completo —flechas entre días, RePág/AvPág entre meses, Inicio y Fin
 * dentro de la semana— y anuncia cada celda con su fecha. Lo nuestro es qué
 * días se pueden elegir y cuántos horarios tiene cada uno.
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
  const days = useMemo(() => [...countByDay.keys()].sort(), [countByDay]);
  const first = days[0];
  const last = days.at(-1);

  // Sin días disponibles no hay nada que recorrer.
  if (!first || !last) return null;

  const value = activeDay && countByDay.has(activeDay) ? parseDate(activeDay) : null;

  return (
    <I18nProvider locale="es-CO">
      <Calendar
        aria-label="Calendario de disponibilidad"
        firstDayOfWeek="mon"
        minValue={parseDate(first)}
        maxValue={parseDate(last)}
        value={value}
        defaultFocusedValue={value ?? parseDate(first)}
        isDateUnavailable={(date) => !countByDay.has(date.toString())}
        onChange={(date: CalendarDate) => onSelect(date.toString())}
      >
        <Calendar.Header>
          <Calendar.NavButton slot="previous" aria-label="Mes anterior" />
          <Calendar.Heading />
          <Calendar.NavButton slot="next" aria-label="Mes siguiente" />
        </Calendar.Header>

        <Calendar.Grid>
          <Calendar.GridHeader>
            {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
          </Calendar.GridHeader>
          <Calendar.GridBody>
            {(date) => {
              const count = countByDay.get(date.toString()) ?? 0;
              return (
                // React Aria ya nombra cada celda con su fecha y su estado
                // (seleccionada, no disponible); el punto solo refuerza en
                // pantalla qué días tienen horarios.
                <Calendar.Cell date={date}>
                  {({ formattedDate }) => (
                    <>
                      {formattedDate}
                      {count > 0 && <Calendar.CellIndicator />}
                    </>
                  )}
                </Calendar.Cell>
              );
            }}
          </Calendar.GridBody>
        </Calendar.Grid>
      </Calendar>
    </I18nProvider>
  );
}
