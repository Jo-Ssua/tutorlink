export interface AppConfiguration {
  nodeEnv: string;
  port: number;
  apiPrefix: string;
  databaseUrl: string;
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

export default (): AppConfiguration => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number.parseInt(process.env.PORT ?? '3000', 10),
  apiPrefix: process.env.API_PREFIX ?? 'api/v1',
  databaseUrl: process.env.DATABASE_URL ?? '',
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
  institutionalEmailDomains: (process.env.INSTITUTIONAL_EMAIL_DOMAINS ?? 'universidad.edu.co')
    .split(',')
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean),
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3001,http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
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
  exposeDevCodes: (process.env.EXPOSE_DEV_CODES ?? 'true') === 'true',
  seedOnStart: (process.env.SEED_ON_START ?? 'false') === 'true',
});
