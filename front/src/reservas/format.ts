import type { ChosenModality, Modality } from './types';

const copFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

export const formatCop = (value: number): string => copFormatter.format(value);

export function initials(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

const timeFormatter = new Intl.DateTimeFormat('es-CO', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

export function formatTime(iso: string): string {
  return timeFormatter
    .format(new Date(iso))
    .replace(/\s/g, ' ')
    .replace(/a\.\s?m\./i, 'A.M.')
    .replace(/p\.\s?m\./i, 'P.M.');
}

export function formatTimeRange(startIso: string, endIso: string): string {
  return `${formatTime(startIso)} - ${formatTime(endIso)}`;
}

export function formatLongDate(iso: string): string {
  const text = new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(iso));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatShortDay(iso: string): { weekday: string; day: number } {
  const date = new Date(iso);
  const weekday = new Intl.DateTimeFormat('es-CO', { weekday: 'short' })
    .format(date)
    .replace('.', '');
  return { weekday: weekday.charAt(0).toUpperCase() + weekday.slice(1), day: date.getDate() };
}

export function formatMonthYear(iso: string): string {
  const text = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' }).format(
    new Date(iso),
  );
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Clave local AAAA-MM-DD para agrupar franjas por día. */
export function dayKey(iso: string): string {
  const date = new Date(iso);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  const label = Number.isInteger(hours) ? String(hours) : hours.toFixed(1).replace('.', ',');
  return `${label} ${hours === 1 ? 'hora' : 'horas'}`;
}

export function durationMinutes(startIso: string, endIso: string): number {
  return Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60_000);
}

export const MODALITY_LABEL: Record<Modality, string> = {
  VIRTUAL: 'Virtual',
  IN_PERSON: 'Presencial',
  HYBRID: 'Virtual o presencial',
};

export const CHOSEN_MODALITY_LABEL: Record<ChosenModality, string> = {
  VIRTUAL: 'Virtual (Online)',
  IN_PERSON: 'Presencial',
};

/** Modalidades que el estudiante puede elegir según la franja seleccionada. */
export function allowedModalities(slotModality: Modality): ChosenModality[] {
  return slotModality === 'HYBRID' ? ['VIRTUAL', 'IN_PERSON'] : [slotModality];
}
