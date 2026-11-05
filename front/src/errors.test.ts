import { describe, expect, it } from 'vitest';
import { ApiError } from './api';
import { toFriendlyError } from './errors';

describe('toFriendlyError', () => {
  it('traduce los codigos conocidos de la API', () => {
    const friendly = toFriendlyError(
      new ApiError('REVIEW_ALREADY_EXISTS', 'Review already exists', 409),
    );

    expect(friendly.message).toBe(
      'Ya calificaste esta sesión. No se permiten reseñas duplicadas.',
    );
    expect(friendly.details).toEqual([]);
  });

  it('conserva el mensaje y los detalles de un codigo sin traduccion', () => {
    const friendly = toFriendlyError(
      new ApiError('TUTOR_NOT_AVAILABLE', 'El tutor no tiene franjas libres', 409, [
        'startAt debe ser futuro',
      ]),
    );

    expect(friendly.message).toBe('El tutor no tiene franjas libres');
    expect(friendly.details).toEqual(['startAt debe ser futuro']);
  });

  it('usa un mensaje genérico para valores que no son errores', () => {
    expect(toFriendlyError('boom').message).toBe(
      'Ocurrió un error inesperado. Intenta de nuevo.',
    );
  });
});
