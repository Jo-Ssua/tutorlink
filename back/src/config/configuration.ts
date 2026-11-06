export type MailTransport = 'smtp' | 'console';

export interface MailSmtpConfiguration {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
}

export interface MailConfiguration {
  transport: MailTransport;
  from: string;
  /** Ruta del frontend que verifica la cuenta con los datos del enlace. */
  verificationPath: string;
  loginPath: string;
  smtp: MailSmtpConfiguration;
}

export interface AppConfiguration {
  nodeEnv: string;
  port: number;
  apiPrefix: string;
  /** URL publica del frontend, base de los enlaces que viajan por correo. */
  appUrl: string;
  databaseUrl: string;
  mail: MailConfiguration;
  jwt: {
    accessSecret: string;
    accessExpiresIn: string;
    refreshSecret: string;
    refreshExpiresIn: string;
  };
  security: {
    emailCodeSecret: string;
    anonymitySalt: string;
  };
  institutionalEmailDomains: string[];
  /**
   * Facultades habilitadas por dominio institucional, en codigos de facultad.
   * Vacio (por defecto) significa que cualquier programa del catalogo es valido.
   */
  institutionalDomainFaculties: Record<string, string[]>;
  corsOrigins: string[];
  platformFeePercent: number;
  cancellationWindowHours: number;
  studyMatch: {
    ttlMinutes: {
      CRITICAL: number;
      HIGH: number;
      MEDIUM: number;
      LOW: number;
    };
    studentConfirmMinutes: number;
    weights: {
      professorMatch: number;
      rating: number;
      availability: number;
      workload: number;
    };
  };
  exposeDevCodes: boolean;
  seedOnStart: boolean;
}

function parseList(raw: string | undefined, fallback = ''): string[] {
  return (raw ?? fallback)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * Formato: `dominio:FAC1|FAC2;otro.dominio:FAC3`.
 * Los codigos son los de `faculties.code` del catalogo academico.
 */
function parseDomainFaculties(raw: string | undefined): Record<string, string[]> {
  const scopes: Record<string, string[]> = {};

  for (const entry of (raw ?? '').split(';')) {
    const separator = entry.indexOf(':');
    if (separator < 1) {
      continue;
    }

    const domain = entry.slice(0, separator).trim().toLowerCase();
    const codes = entry
      .slice(separator + 1)
      .split('|')
      .map((code) => code.trim().toUpperCase())
      .filter(Boolean);

    if (domain && codes.length > 0) {
      scopes[domain] = codes;
    }
  }

  return scopes;
}

export default (): AppConfiguration => {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const mailTransport: MailTransport =
    process.env.MAIL_TRANSPORT === 'smtp' ? 'smtp' : 'console';

  return {
    nodeEnv,
    port: Number.parseInt(process.env.PORT ?? '3000', 10),
    apiPrefix: process.env.API_PREFIX ?? 'api/v1',
    appUrl: process.env.APP_URL ?? 'http://localhost:5173',
    databaseUrl: process.env.DATABASE_URL ?? '',
    mail: {
      transport: mailTransport,
      from: process.env.MAIL_FROM ?? 'TutorLink <no-reply@tutorlink.local>',
      verificationPath: process.env.MAIL_VERIFICATION_PATH ?? '/verificar',
      loginPath: process.env.MAIL_LOGIN_PATH ?? '/login',
      smtp: {
        host: process.env.SMTP_HOST ?? '',
        port: Number.parseInt(process.env.SMTP_PORT ?? '587', 10),
        secure: (process.env.SMTP_SECURE ?? 'false') === 'true',
        user: process.env.SMTP_USER || undefined,
        pass: process.env.SMTP_PASS || undefined,
      },
    },
    jwt: {
      accessSecret: process.env.JWT_ACCESS_SECRET ?? '',
      accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
      refreshSecret: process.env.JWT_REFRESH_SECRET ?? '',
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
    },
    security: {
      emailCodeSecret: process.env.EMAIL_CODE_SECRET ?? process.env.JWT_ACCESS_SECRET ?? '',
      anonymitySalt: process.env.ANONYMITY_SALT ?? 'tutorlink-anonymous-student',
    },
    institutionalEmailDomains: parseList(
      process.env.INSTITUTIONAL_EMAIL_DOMAINS,
      'universidad.edu.co',
    ).map((domain) => domain.toLowerCase()),
    institutionalDomainFaculties: parseDomainFaculties(
      process.env.INSTITUTIONAL_DOMAIN_FACULTIES,
    ),
    corsOrigins: parseList(
      process.env.CORS_ORIGINS,
      'http://localhost:3001,http://localhost:5173',
    ),
    platformFeePercent: Number.parseFloat(process.env.PLATFORM_FEE_PERCENT ?? '10'),
    cancellationWindowHours: Number.parseInt(process.env.CANCELLATION_WINDOW_HOURS ?? '24', 10),
    studyMatch: {
      ttlMinutes: {
        CRITICAL: Number.parseInt(process.env.STUDYMATCH_TTL_CRITICAL_MINUTES ?? '5', 10),
        HIGH: Number.parseInt(process.env.STUDYMATCH_TTL_HIGH_MINUTES ?? '10', 10),
        MEDIUM: Number.parseInt(process.env.STUDYMATCH_TTL_MEDIUM_MINUTES ?? '20', 10),
        LOW: Number.parseInt(process.env.STUDYMATCH_TTL_LOW_MINUTES ?? '30', 10),
      },
      studentConfirmMinutes: Number.parseInt(
        process.env.STUDYMATCH_STUDENT_CONFIRM_MINUTES ?? '10',
        10,
      ),
      weights: {
        professorMatch: Number.parseFloat(process.env.STUDYMATCH_WEIGHT_PROFESSOR ?? '35'),
        rating: Number.parseFloat(process.env.STUDYMATCH_WEIGHT_RATING ?? '30'),
        availability: Number.parseFloat(process.env.STUDYMATCH_WEIGHT_AVAILABILITY ?? '25'),
        workload: Number.parseFloat(process.env.STUDYMATCH_WEIGHT_WORKLOAD ?? '10'),
      },
    },
    // Nunca se expone el codigo de verificacion en produccion, aunque la variable lo pida.
    exposeDevCodes: nodeEnv !== 'production' && process.env.EXPOSE_DEV_CODES === 'true',
    seedOnStart: (process.env.SEED_ON_START ?? 'false') === 'true',
  };
};
