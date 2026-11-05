import { ApiError } from './api';

export interface FriendlyError {
  message: string;
  details: string[];
}

/**
 * Mensajes propios por codigo de error de la API.
 *
 * Los codigos que no aparecen aqui muestran el mensaje del backend, que a veces
 * es mas util que cualquier texto fijo: `NON_INSTITUTIONAL_EMAIL` enumera los
 * dominios aceptados y `PROGRAM_NOT_IN_DOMAIN_SCOPE` las facultades
 * habilitadas, asi que no se sobreescriben.
 */
const MESSAGES: Record<string, string> = {
  // Sesion
  INVALID_CREDENTIALS:
    'Correo o contraseña incorrectos. Revisa los datos e inténtalo de nuevo.',
  EMAIL_NOT_VERIFIED:
    'Falta verificar tu correo institucional. Busca el código que te enviamos o pide uno nuevo.',
  ACCOUNT_SUSPENDED:
    'Tu cuenta está suspendida. Escríbele al equipo de TutorLink para reactivarla.',
  TOKEN_REVOKED: 'Tu sesión se cerró. Inicia sesión nuevamente.',
  REFRESH_TOKEN_REVOKED: 'Tu sesión se cerró. Inicia sesión nuevamente.',
  ACCOUNT_NOT_ACTIVE: 'Tu cuenta no está activa. Verifica tu correo institucional.',
  RATE_LIMITED: 'Demasiados intentos seguidos. Espera un minuto y vuelve a intentarlo.',

  // Verificacion de la cuenta
  INVALID_VERIFICATION_CODE:
    'El código no es válido. Revísalo o solicita uno nuevo.',
  VERIFICATION_CODE_EXPIRED: 'El código expiró. Solicita uno nuevo para continuar.',
  VERIFICATION_ATTEMPTS_EXCEEDED:
    'Superaste los intentos permitidos. Solicita un código nuevo.',
  EMAIL_ALREADY_VERIFIED: 'Esta cuenta ya está verificada. Inicia sesión normalmente.',
  PROGRAM_NOT_FOUND:
    'El programa académico seleccionado ya no existe. Vuelve a elegirlo de la lista.',

  // Calificaciones y reservas
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

/** Mensajes por campo que devuelve la validación del backend, ya aplanados. */
export function fieldMessages(error: unknown): Record<string, string[]> {
  return error instanceof ApiError ? error.fields : {};
}

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
