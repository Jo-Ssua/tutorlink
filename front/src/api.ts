import { clearSession, getRefreshToken, loadSession, saveSession } from './session';
import type {
  AdminStats,
  ApiErrorBody,
  ApiSuccess,
  BookingList,
  CreateReviewPayload,
  CreateReviewResult,
  CatalogSubject,
  LoginResult,
  Modality,
  Program,
  RegisterPayload,
  SessionUser,
  TutorApplicationList,
  TutorOwnProfile,
  VerificationPending,
  VerifyEmailResult,
} from './types';
import type { AvailabilitySlot } from './reservas/types';

const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1').replace(
  /\/$/,
  '',
);

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: string[];
  /** Mensajes por campo que devuelve la validación del backend. */
  readonly fields: Record<string, string[]>;

  constructor(
    code: string,
    message: string,
    status: number,
    details: string[] = [],
    fields: Record<string, string[]> = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
    this.fields = fields;
  }
}

type SessionExpiredListener = () => void;

const sessionExpiredListeners = new Set<SessionExpiredListener>();

/**
 * Avisa cuando la sesión deja de servir y no se pudo renovar. Lo escucha el
 * `AuthProvider`, que es el único que sabe limpiar el estado y redirigir: así
 * cualquier pantalla puede llamar a la API sin preocuparse por el 401.
 *
 * Devuelve la función para darse de baja.
 */
export function onSessionExpired(listener: SessionExpiredListener): () => void {
  sessionExpiredListeners.add(listener);
  return () => {
    sessionExpiredListeners.delete(listener);
  };
}

function notifySessionExpired(): void {
  clearSession();
  for (const listener of sessionExpiredListeners) {
    listener();
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
      error.fields ?? {},
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
    return false;
  }

  const data = (body as ApiSuccess<LoginResult>).data;
  saveSession(data);
  return true;
}

/** Rutas públicas: un 401 suyo es un error de credenciales, no una sesión caída. */
const PUBLIC_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/verify-email',
  '/auth/resend-verification',
  '/auth/refresh',
  '/catalog',
];

export async function request<T>(
  path: string,
  init: RequestInit = {},
  canRetry = true,
): Promise<T> {
  const session = loadSession();
  const response = await rawRequest(path, {
    ...init,
    headers: {
      ...(session ? { Authorization: `Bearer ${session.accessToken}` } : {}),
      ...init.headers,
    },
  });

  const isPublic = PUBLIC_PATHS.some((publicPath) => path.startsWith(publicPath));

  if (response.status === 401 && canRetry && !isPublic) {
    if (await refreshSession()) {
      return request<T>(path, init, false);
    }

    notifySessionExpired();
    throw new ApiError('SESSION_EXPIRED', 'Tu sesión expiró. Inicia sesión nuevamente.', 401);
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

export async function register(payload: RegisterPayload): Promise<VerificationPending> {
  const body: RegisterPayload = {
    fullName: payload.fullName.trim(),
    email: payload.email.trim().toLowerCase(),
    password: payload.password,
  };
  // El backend valida con `forbidNonWhitelisted`, así que los opcionales vacíos
  // no se envían.
  if (payload.studentCode?.trim()) body.studentCode = payload.studentCode.trim();
  if (payload.programId) body.programId = payload.programId;
  if (payload.semester) body.semester = payload.semester;

  return request<VerificationPending>(
    '/auth/register',
    { method: 'POST', body: JSON.stringify(body) },
    false,
  );
}

export async function verifyEmail(email: string, code: string): Promise<VerifyEmailResult> {
  return request<VerifyEmailResult>(
    '/auth/verify-email',
    {
      method: 'POST',
      body: JSON.stringify({ email: email.trim().toLowerCase(), code: code.trim() }),
    },
    false,
  );
}

export async function resendVerification(email: string): Promise<VerificationPending> {
  return request<VerificationPending>(
    '/auth/resend-verification',
    { method: 'POST', body: JSON.stringify({ email: email.trim().toLowerCase() }) },
    false,
  );
}

export async function getPrograms(): Promise<Program[]> {
  return request<Program[]>('/catalog/programs');
}

/** Confirma contra la API que la sesión guardada sigue siendo válida. */
export async function getMe(): Promise<SessionUser> {
  return request<SessionUser>('/auth/me');
}

export async function getMyCompletedBookings(page = 1, limit = 20): Promise<BookingList> {
  return request<BookingList>(`/bookings/my?status=COMPLETED&page=${page}&limit=${limit}`);
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

export async function getTutorOwnProfile(): Promise<TutorOwnProfile> {
  return request<TutorOwnProfile>('/tutor/profile');
}

export async function updateTutorOwnProfile(payload: {
  bio: string;
  hourlyRate: number;
  modalities: Modality[];
}): Promise<TutorOwnProfile> {
  return request<TutorOwnProfile>('/tutor/profile', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function listCatalogSubjects(search: string): Promise<CatalogSubject[]> {
  const query = new URLSearchParams();
  if (search.trim()) query.set('search', search.trim());
  const suffix = query.toString();
  return request<CatalogSubject[]>(`/catalog/subjects${suffix ? `?${suffix}` : ''}`);
}

export async function addTutorSubject(subjectId: string, evidenceUrl?: string): Promise<void> {
  await request('/tutor/subjects', {
    method: 'POST',
    body: JSON.stringify({
      subjectId,
      ...(evidenceUrl?.trim() ? { evidenceUrl: evidenceUrl.trim() } : {}),
    }),
  });
}

export async function removeTutorSubject(tutorSubjectId: string): Promise<void> {
  await request(`/tutor/subjects/${tutorSubjectId}`, { method: 'DELETE' });
}

export async function listTutorAvailability(): Promise<AvailabilitySlot[]> {
  return request<AvailabilitySlot[]>('/tutor/availability');
}

export async function createTutorAvailability(payload: {
  startAt: string;
  endAt: string;
  modality: Modality;
}): Promise<AvailabilitySlot> {
  return request<AvailabilitySlot>('/tutor/availability', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateTutorAvailability(
  id: string,
  payload: { startAt: string; endAt: string; modality: Modality },
): Promise<AvailabilitySlot> {
  return request<AvailabilitySlot>(`/tutor/availability/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteTutorAvailability(id: string): Promise<void> {
  await request(`/tutor/availability/${id}`, { method: 'DELETE' });
}

export async function getTutorBookings(page = 1, limit = 20): Promise<BookingList> {
  return request<BookingList>(`/bookings/tutor?page=${page}&limit=${limit}`);
}

export async function getAdminStats(): Promise<AdminStats> {
  return request<AdminStats>('/admin/stats');
}

export async function getPendingTutorApplications(): Promise<TutorApplicationList> {
  return request<TutorApplicationList>('/admin/tutor-applications?status=PENDING&limit=20');
}

export { API_URL };
