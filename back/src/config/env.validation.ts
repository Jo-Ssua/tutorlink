const REQUIRED_KEYS = ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const;

export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const errors: string[] = [];

  for (const key of REQUIRED_KEYS) {
    const value = config[key];
    if (typeof value !== 'string' || value.trim().length === 0) {
      errors.push(`${key} es obligatorio`);
    }
  }

  for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const) {
    const value = config[key];
    if (typeof value === 'string' && value.length < 32) {
      errors.push(`${key} debe tener al menos 32 caracteres`);
    }
  }

  if (
    typeof config.JWT_ACCESS_SECRET === 'string' &&
    typeof config.JWT_REFRESH_SECRET === 'string' &&
    config.JWT_ACCESS_SECRET === config.JWT_REFRESH_SECRET
  ) {
    errors.push('JWT_ACCESS_SECRET y JWT_REFRESH_SECRET deben ser diferentes');
  }

  const numericKeys = [
    'PORT',
    'PLATFORM_FEE_PERCENT',
    'CANCELLATION_WINDOW_HOURS',
    'STUDYMATCH_TTL_CRITICAL_MINUTES',
    'STUDYMATCH_TTL_HIGH_MINUTES',
    'STUDYMATCH_TTL_MEDIUM_MINUTES',
    'STUDYMATCH_TTL_LOW_MINUTES',
    'STUDYMATCH_STUDENT_CONFIRM_MINUTES',
  ];

  for (const key of numericKeys) {
    const value = config[key];
    if (value !== undefined && value !== '' && Number.isNaN(Number(value))) {
      errors.push(`${key} debe ser numerico`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Configuracion invalida:\n- ${errors.join('\n- ')}`);
  }

  return config;
}
