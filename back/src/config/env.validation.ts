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

  const mailTransport = config.MAIL_TRANSPORT;
  if (
    mailTransport !== undefined &&
    mailTransport !== '' &&
    mailTransport !== 'smtp' &&
    mailTransport !== 'console'
  ) {
    errors.push("MAIL_TRANSPORT debe ser 'smtp' o 'console'");
  }

  if (mailTransport === 'smtp') {
    for (const key of ['SMTP_HOST', 'MAIL_FROM'] as const) {
      const value = config[key];
      if (typeof value !== 'string' || value.trim().length === 0) {
        errors.push(`${key} es obligatorio cuando MAIL_TRANSPORT=smtp`);
      }
    }
  }

  const appUrl = config.APP_URL;
  if (typeof appUrl === 'string' && appUrl.trim().length > 0) {
    // `new URL('localhost:5173')` no falla: lo lee como protocolo "localhost:".
    // Hay que exigir http o https de forma explicita.
    let protocol = '';
    try {
      protocol = new URL(appUrl).protocol;
    } catch {
      protocol = '';
    }

    if (protocol !== 'http:' && protocol !== 'https:') {
      errors.push('APP_URL debe ser una URL absoluta http o https, por ejemplo http://localhost:5173');
    }
  }

  // El codigo de verificacion solo puede viajar en la respuesta HTTP fuera de produccion.
  if (config.EXPOSE_DEV_CODES === 'true' && config.NODE_ENV === 'production') {
    errors.push('EXPOSE_DEV_CODES no puede ser true cuando NODE_ENV=production');
  }

  const numericKeys = [
    'PORT',
    'SMTP_PORT',
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
