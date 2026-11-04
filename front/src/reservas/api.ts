import { request } from '../api';
import type {
  AvailabilitySlot,
  CreateBookingPayload,
  CreatedBooking,
  QuoteResult,
  TutorList,
  TutorProfile,
} from './types';

/**
 * Endpoints del flujo de reserva. El transporte (token, renovación en 401 y
 * aviso de sesión caída) es el `request()` compartido de `../api`: esta sección
 * tenía antes su propio cliente, que no renovaba el token ni limpiaba la sesión.
 *
 * Los errores llegan como `ApiError`, con `fields` para la validación por campo.
 */
export function listTutors(): Promise<TutorList> {
  return request<TutorList>('/tutors?limit=50&sortBy=RATING');
}

export function getTutor(tutorProfileId: string): Promise<TutorProfile> {
  return request<TutorProfile>(`/tutors/${tutorProfileId}`);
}

export function getAvailability(tutorProfileId: string): Promise<AvailabilitySlot[]> {
  return request<AvailabilitySlot[]>(`/tutors/${tutorProfileId}/availability`);
}

export function quoteBooking(tutorProfileId: string, slotId: string): Promise<QuoteResult> {
  return request<QuoteResult>('/bookings/quote', {
    method: 'POST',
    body: JSON.stringify({ tutorProfileId, slotId }),
  });
}

export function createBooking(payload: CreateBookingPayload): Promise<CreatedBooking> {
  return request<CreatedBooking>('/bookings', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
