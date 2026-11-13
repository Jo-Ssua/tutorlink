import { request } from '../api';
import type { RequestsDashboard, RespondResult } from './types';

export function getRequestsDashboard(): Promise<RequestsDashboard> {
  return request<RequestsDashboard>('/tutor/requests/dashboard');
}

/** El backend avisa al estudiante del cambio de estado al aceptar. */
export function acceptRequest(bookingId: string): Promise<RespondResult> {
  return request<RespondResult>(`/bookings/${bookingId}/accept`, { method: 'POST' });
}

/** El motivo es opcional; si va, se le muestra al estudiante en su notificación. */
export function rejectRequest(bookingId: string, reason?: string): Promise<RespondResult> {
  const trimmed = reason?.trim();

  return request<RespondResult>(`/bookings/${bookingId}/reject`, {
    method: 'POST',
    body: JSON.stringify(trimmed ? { reason: trimmed } : {}),
  });
}
