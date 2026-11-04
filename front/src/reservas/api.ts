import { loadSession } from '../session';
import type {
  ApiErrorBody,
  ApiSuccess,
  AvailabilitySlot,
  CreateBookingPayload,
  CreatedBooking,
  QuoteResult,
  TutorList,
  TutorProfile,
  TutorReviewList,
} from './types';

const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1').replace(
  /\/$/,
  '',
);

/** Error de la API con el detalle por campo que devuelve la validación del backend. */
export class ReservasApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly details: string[] = [],
    readonly fields: Record<string, string[]> = {},
  ) {
    super(message);
    this.name = 'ReservasApiError';
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const session = loadSession();
  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(session ? { Authorization: `Bearer ${session.accessToken}` } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new ReservasApiError(
      'NETWORK_ERROR',
      `No se pudo conectar con la API en ${API_URL}. Verifica que el backend esté corriendo.`,
      0,
    );
  }

  const text = await response.text();
  const body = text ? (JSON.parse(text) as unknown) : null;

  if (!response.ok) {
    if (response.status === 401) {
      throw new ReservasApiError(
        'SESSION_EXPIRED',
        'Tu sesión no es válida o expiró. Inicia sesión nuevamente.',
        401,
      );
    }
    const error = (body as ApiErrorBody | null)?.error;
    throw new ReservasApiError(
      error?.code ?? 'UNKNOWN_ERROR',
      error?.message ?? 'No fue posible completar la solicitud.',
      response.status,
      error?.details ?? [],
      error?.fields ?? {},
    );
  }

  return (body as ApiSuccess<T>).data;
}

export function listTutors(): Promise<TutorList> {
  return request<TutorList>('/tutors?limit=50&sortBy=RATING');
}

export function getTutor(tutorProfileId: string): Promise<TutorProfile> {
  return request<TutorProfile>(`/tutors/${tutorProfileId}`);
}

export function getTutorReviews(
  tutorProfileId: string,
  page = 1,
  limit = 5,
): Promise<TutorReviewList> {
  return request<TutorReviewList>(
    `/tutors/${tutorProfileId}/reviews?page=${page}&limit=${limit}`,
  );
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
