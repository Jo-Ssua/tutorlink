import { ApiError } from './api';

export interface FriendlyError {
  message: string;
  details: string[];
}

const MESSAGES: Record<string, string> = {
  BOOKING_NOT_COMPLETED:
    'Solo puedes calificar una sesión que haya sido marcada como completada.',
  REVIEW_ALREADY_EXISTS: 'Ya calificaste esta sesión. No se permiten reseñas duplicadas.',
  BOOKING_NOT_FOUND:
    'La sesión no existe o no pertenece a tu cuenta. Actualiza la lista e inténtalo de nuevo.',
  VALIDATION_ERROR:
    'Revisa los datos enviados: la calificación debe ser un número entero entre 1 y 5.',
  SESSION_EXPIRED: 'Tu sesión expiró. Inicia sesión nuevamente.',
  NETWORK_ERROR:
    'No se pudo conectar con el servidor. Verifica que la API esté disponible.',
};

export function toFriendlyError(error: unknown): FriendlyError {
  if (error instanceof ApiError) {
    return {
      message: MESSAGES[error.code] ?? error.message,
      details: error.details,
    };
  }

  if (error instanceof Error) {
    return { message: error.message, details: [] };
  }

  return {
    message: 'Ocurrió un error inesperado. Intenta de nuevo.',
    details: [],
  };
}
