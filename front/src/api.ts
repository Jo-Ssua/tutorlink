import { clearSession, getRefreshToken, loadSession, saveSession } from './session';
import type {
  ApiErrorBody,
  ApiSuccess,
  BookingList,
  CreateReviewPayload,
  CreateReviewResult,
  LoginResult,
} from './types';

const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1').replace(
  /\/$/,
  '',
);

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: string[];

  constructor(code: string, message: string, status: number, details: string[] = []) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function toApiError(response: Response, body: unknown): ApiError {
  if (body && typeof body === 'object' && 'error' in body) {
    const error = (body as ApiErrorBody).error;
    return new ApiError(
      error.code ?? 'UNKNOWN_ERROR',
      error.message ?? 'No fue posible completar la solicitud.',
      response.status,
      error.details ?? [],
    );
  }

  return new ApiError(
    'NETWORK_ERROR',
    response.status >= 500
      ? 'El servidor no respondió correctamente. Intenta de nuevo.'
      : 'No fue posible completar la solicitud.',
    response.status,
  );
}

async function rawRequest(path: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError(
      'NETWORK_ERROR',
      `No se pudo conectar con la API en ${API_URL}. Verifica que el backend esté corriendo.`,
      0,
    );
  }
}

async function refreshSession(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  const response = await rawRequest('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });

  const body = await readBody(response);
  if (!response.ok) {
    clearSession();
    return false;
  }

  const data = (body as ApiSuccess<LoginResult>).data;
  saveSession(data);
  return true;
}

async function request<T>(path: string, init: RequestInit = {}, canRetry = true): Promise<T> {
  const session = loadSession();
  const response = await rawRequest(path, {
    ...init,
    headers: {
      ...(session ? { Authorization: `Bearer ${session.accessToken}` } : {}),
      ...init.headers,
    },
  });

  if (response.status === 401 && canRetry && !path.startsWith('/auth/login')) {
    const refreshed = await refreshSession();
    if (refreshed) {
      return request<T>(path, init, false);
    }
    throw new ApiError(
      'SESSION_EXPIRED',
      'Tu sesión expiró. Inicia sesión nuevamente.',
      401,
    );
  }

  const body = await readBody(response);

  if (!response.ok) {
    throw toApiError(response, body);
  }

  return (body as ApiSuccess<T>).data;
}

export async function login(email: string, password: string): Promise<LoginResult> {
  const data = await request<LoginResult>(
    '/auth/login',
    {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    },
    false,
  );
  saveSession(data);
  return data;
}

export async function logoutRemote(): Promise<void> {
  try {
    await request('/auth/logout', { method: 'POST' }, false);
  } catch {
    // El cierre de sesión local es suficiente si la API no está disponible.
  } finally {
    clearSession();
  }
}

export async function getMyCompletedBookings(
  page = 1,
  limit = 20,
): Promise<BookingList> {
  return request<BookingList>(
    `/bookings/my?status=COMPLETED&page=${page}&limit=${limit}`,
  );
}

export async function createBookingReview(
  bookingId: string,
  payload: CreateReviewPayload,
): Promise<CreateReviewResult> {
  const body: CreateReviewPayload = { rating: payload.rating };
  if (payload.comment?.trim()) body.comment = payload.comment.trim();
  if (payload.isAnonymous !== undefined) body.isAnonymous = payload.isAnonymous;

  return request<CreateReviewResult>(`/bookings/${bookingId}/review`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export { API_URL };
