import { request } from '../api';
import type { HistoryDetail, HistoryFilters, HistoryList, HistorySummary } from './types';

export const HISTORY_PAGE_SIZE = 10;

/** Inicio del dia local elegido, como instante ISO (UTC). */
function startOfLocalDay(date: string): string {
  return new Date(`${date}T00:00:00`).toISOString();
}

/** Ultimo milisegundo del dia local elegido, para que `Hasta` incluya ese dia. */
function endOfLocalDay(date: string): string {
  return new Date(`${date}T23:59:59.999`).toISOString();
}

export function getTutorHistory(filters: HistoryFilters, page = 1): Promise<HistoryList> {
  const query = new URLSearchParams({ page: String(page), limit: String(HISTORY_PAGE_SIZE) });
  if (filters.from) query.set('from', startOfLocalDay(filters.from));
  if (filters.to) query.set('to', endOfLocalDay(filters.to));
  if (filters.subjectId) query.set('subjectId', filters.subjectId);
  if (filters.status) query.set('status', filters.status);

  return request<HistoryList>(`/tutor/history?${query.toString()}`);
}

export function getTutorHistorySummary(): Promise<HistorySummary> {
  return request<HistorySummary>('/tutor/history/summary');
}

export function getTutorHistoryDetail(bookingId: string): Promise<HistoryDetail> {
  return request<HistoryDetail>(`/tutor/history/${bookingId}`);
}
