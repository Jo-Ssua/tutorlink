import { createHash, randomInt, timingSafeEqual } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { Role, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { addMinutes } from '../common/utils/date';
import { money } from '../common/utils/money';
import {
  LoginDto,
  RefreshTokenDto,
  RegisterDto,
  ResendVerificationDto,
  VerifyEmailDto,
} from './dto/auth.dto';

/** Vigencia del codigo de verificacion de correo. */
const VERIFICATION_TTL_MINUTES = 15;
/** Espera minima entre dos envios de codigo al mismo correo. */
const RESEND_COOLDOWN_MS = 60_000;
/** Intentos fallidos de codigo antes de invalidarlo y exigir uno nuevo. */
const MAX_VERIFICATION_ATTEMPTS = 5;
/** Intentos de inicio de sesion fallidos antes de bloquear la cuenta. */
const MAX_FAILED_LOGINS = 5;
/** Duracion del bloqueo por intentos fallidos. */
const LOGIN_LOCK_MINUTES = 15;

/**
 * Hash bcrypt de un valor aleatorio descartado. Se compara contra el cuando el
 * correo no existe, para que una cuenta inexistente tarde lo mismo que una real
 * y el tiempo de respuesta no permita distinguirlas.
 */
const DECOY_PASSWORD_HASH = '$2b$12$aexmW2MquiLQLL3Z0ERsEOGIcnQDXRO56/SchSVyx2OjZZZvJmKbi';

/** Relaciones que acompanan al usuario en login, refresh y /auth/me. */
const USER_PROFILES_INCLUDE = {
  studentProfile: { include: { program: { include: { faculty: true } } } },
  tutorProfile: {
    include: {
      subjects: { include: { subject: true } },
      professors: { include: { professor: true } },
    },
  },
};

interface TokenPayload {
  sub: string;
  email: string;
  role: Role;
  type: 'access' | 'refresh';
  /** Version de sesion: al cerrar sesion se incrementa y el token deja de valer. */
  tv: number;
  jti?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  async register(dto: RegisterDto) {
    this.assertInstitutionalEmail(dto.email);
    await this.assertProgramIsAllowed(dto.email, dto.programId);

    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: {
        id: true,
        email: true,
        fullName: true,
        status: true,
        verificationSentAt: true,
        emailVerificationExpiresAt: true,
      },
    });

    // Un correo ya registrado responde exactamente igual que uno nuevo: la API
    // no revela si la cuenta existe. Solo el dueno del buzon se entera, por el
    // correo que recibe.
    if (existing) {
      return this.continueVerification(existing);
    }

    const verificationCode = this.generateVerificationCode();
    const verificationExpiresAt = addMinutes(new Date(), VERIFICATION_TTL_MINUTES);
    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        fullName: dto.fullName.trim(),
        role: Role.STUDENT,
        status: UserStatus.PENDING_VERIFICATION,
        emailVerificationCodeHash: this.hashVerificationCode(dto.email, verificationCode),
        emailVerificationExpiresAt: verificationExpiresAt,
        verificationSentAt: new Date(),
        studentProfile: {
          create: {
            studentCode: dto.studentCode?.trim(),
            semester: dto.semester,
            programId: dto.programId,
          },
        },
      },
      select: { email: true, fullName: true },
    });

    void this.mail.sendEmailVerification({
      to: user.email,
      fullName: user.fullName,
      code: verificationCode,
      expiresAt: verificationExpiresAt,
    });

    return this.verificationPendingResponse(dto.email, verificationExpiresAt, verificationCode);
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: {
        id: true,
        role: true,
        status: true,
        emailVerificationCodeHash: true,
        emailVerificationExpiresAt: true,
        emailVerificationAttempts: true,
      },
    });

    if (!user) {
      throw new BadRequestException({
        code: 'INVALID_VERIFICATION_CODE',
        message: 'El codigo de verificacion no es valido',
      });
    }

    /*
     * La cuenta verificada va primero: al activarla se borra el hash del
     * codigo, asi que comprobar el hash antes dejaba este 409 inalcanzable y
     * repetir el codigo respondia INVALID_VERIFICATION_CODE.
     */
    if (user.status === UserStatus.ACTIVE) {
      throw new ConflictException({
        code: 'EMAIL_ALREADY_VERIFIED',
        message: 'La cuenta ya se encuentra verificada',
      });
    }

    if (!user.emailVerificationCodeHash) {
      throw new BadRequestException({
        code: 'INVALID_VERIFICATION_CODE',
        message: 'El codigo de verificacion no es valido',
      });
    }

    if (user.emailVerificationAttempts >= MAX_VERIFICATION_ATTEMPTS) {
      await this.invalidateVerificationCode(user.id);
      throw this.attemptsExceeded();
    }

    if (!user.emailVerificationExpiresAt || user.emailVerificationExpiresAt < new Date()) {
      throw new BadRequestException({
        code: 'VERIFICATION_CODE_EXPIRED',
        message: 'El codigo de verificacion expiro. Solicita uno nuevo.',
      });
    }

    const expected = this.hashVerificationCode(dto.email, dto.code);
    if (!this.safeEqual(expected, user.emailVerificationCodeHash)) {
      const attempts = user.emailVerificationAttempts + 1;
      const exhausted = attempts >= MAX_VERIFICATION_ATTEMPTS;

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerificationAttempts: attempts,
          // Al agotar los intentos el codigo deja de servir: hay que pedir otro.
          ...(exhausted
            ? { emailVerificationCodeHash: null, emailVerificationExpiresAt: null }
            : {}),
        },
      });

      if (exhausted) {
        throw this.attemptsExceeded();
      }

      throw new BadRequestException({
        code: 'INVALID_VERIFICATION_CODE',
        message: 'El codigo de verificacion no es valido',
        details: [`Intentos restantes: ${MAX_VERIFICATION_ATTEMPTS - attempts}`],
      });
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        emailVerificationCodeHash: null,
        emailVerificationExpiresAt: null,
        emailVerificationAttempts: 0,
      },
      select: { id: true, email: true, role: true, status: true },
    });

    await this.prisma.notification.create({
      data: {
        userId: user.id,
        type: 'SYSTEM',
        title: 'Cuenta verificada',
        message: 'Tu cuenta institucional fue verificada correctamente. Ya puedes usar TutorLink.',
      },
    });

    return { verified: true, user: updated };
  }

  async resendVerification(dto: ResendVerificationDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: {
        id: true,
        email: true,
        fullName: true,
        status: true,
        verificationSentAt: true,
        emailVerificationExpiresAt: true,
      },
    });

    // Igual que en el registro: la respuesta no cambia si el correo no existe.
    if (!user) {
      return this.verificationPendingResponse(
        dto.email,
        addMinutes(new Date(), VERIFICATION_TTL_MINUTES),
      );
    }

    return this.continueVerification(user);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: USER_PROFILES_INCLUDE,
    });

    // La comparacion se hace siempre, incluso sin cuenta, para que el tiempo de
    // respuesta sea el mismo y no revele si el correo esta registrado.
    const passwordMatches = await bcrypt.compare(
      dto.password,
      user?.passwordHash ?? DECOY_PASSWORD_HASH,
    );

    // Una cuenta bloqueada responde igual que una contrasena incorrecta: no se
    // informa el bloqueo ni cuanto falta para que termine.
    if (user && this.isLocked(user)) {
      throw this.invalidCredentials();
    }

    if (!user || !passwordMatches) {
      if (user) {
        await this.registerFailedLogin(user);
      }

      throw this.invalidCredentials();
    }

    // Desde aqui la contrasena es correcta: quien pregunta ya demostro ser el
    // dueno de la cuenta, asi que el motivo real del rechazo no filtra nada.
    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    }

    if (user.status === UserStatus.PENDING_VERIFICATION) {
      throw new ForbiddenException({
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Debes verificar tu correo institucional antes de iniciar sesion',
      });
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new ForbiddenException({
        code: 'ACCOUNT_SUSPENDED',
        message: 'La cuenta se encuentra suspendida',
      });
    }

    const tokens = await this.issueTokens(user);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return { ...tokens, user: this.toSafeUser(user) };
  }

  async refresh(dto: RefreshTokenDto) {
    let payload: TokenPayload;

    try {
      payload = await this.jwt.verifyAsync<TokenPayload>(dto.refreshToken, {
        secret: this.config.getOrThrow<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH_TOKEN',
        message: 'El refresh token no es valido o expiro',
      });
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH_TOKEN',
        message: 'El token indicado no es un refresh token',
      });
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: USER_PROFILES_INCLUDE,
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException({
        code: 'ACCOUNT_NOT_ACTIVE',
        message: 'La cuenta no esta activa',
      });
    }

    const receivedHash = this.hashToken(dto.refreshToken);
    if (
      !user.refreshTokenHash ||
      !this.safeEqual(receivedHash, user.refreshTokenHash) ||
      payload.tv !== user.tokenVersion
    ) {
      throw new UnauthorizedException({
        code: 'REFRESH_TOKEN_REVOKED',
        message: 'El refresh token fue revocado. Inicia sesion nuevamente.',
      });
    }

    const tokens = await this.issueTokens(user);
    return { ...tokens, user: this.toSafeUser(user) };
  }

  /**
   * Cierra la sesion de verdad: borra el refresh token e incrementa
   * `tokenVersion`, con lo que los access tokens ya emitidos dejan de valer de
   * inmediato en vez de seguir vivos hasta que expiren.
   *
   * El modelo guarda un solo refresh token por usuario, asi que esto cierra la
   * sesion en todos los dispositivos.
   */
  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null, tokenVersion: { increment: 1 } },
    });

    return { loggedOut: true, message: 'Sesion cerrada correctamente' };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: USER_PROFILES_INCLUDE,
    });

    if (!user) {
      throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'Usuario no encontrado' });
    }

    return this.toSafeUser(user);
  }

  private async issueTokens(user: {
    id: string;
    email: string;
    role: Role;
    tokenVersion: number;
  }): Promise<{
    accessToken: string;
    refreshToken: string;
    tokenType: 'Bearer';
    expiresIn: string;
    refreshExpiresIn: string;
  }> {
    const accessExpiresIn = this.config.getOrThrow<string>('jwt.accessExpiresIn');
    const refreshExpiresIn = this.config.getOrThrow<string>('jwt.refreshExpiresIn');

    const accessToken = await this.jwt.signAsync(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        type: 'access',
        tv: user.tokenVersion,
      },
      {
        secret: this.config.getOrThrow<string>('jwt.accessSecret'),
        expiresIn: accessExpiresIn as JwtSignOptions['expiresIn'],
      },
    );

    const refreshToken = await this.jwt.signAsync(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        type: 'refresh',
        tv: user.tokenVersion,
        jti: randomUUID(),
      },
      {
        secret: this.config.getOrThrow<string>('jwt.refreshSecret'),
        expiresIn: refreshExpiresIn as JwtSignOptions['expiresIn'],
      },
    );

    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash: this.hashToken(refreshToken) },
    });

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: accessExpiresIn,
      refreshExpiresIn,
    };
  }

  /**
   * Avanza la verificacion de una cuenta que ya existe y devuelve siempre la
   * misma respuesta, sin importar en que estado este:
   *
   * - PENDING_VERIFICATION: emite un codigo nuevo, salvo que el anterior se
   *   haya enviado hace menos de 60 segundos.
   * - ACTIVE: no emite codigo y avisa por correo que la cuenta ya existe.
   * - SUSPENDED: no emite codigo y no envia correo.
   *
   * La contrasena y el nombre de una cuenta sin verificar NO se sobreescriben:
   * de lo contrario cualquiera podria pisar el registro pendiente de otra
   * persona con solo conocer su correo.
   */
  private async continueVerification(user: {
    id: string;
    email: string;
    fullName: string;
    status: UserStatus;
    verificationSentAt: Date | null;
    emailVerificationExpiresAt: Date | null;
  }) {
    const now = new Date();
    const fallbackExpiresAt = addMinutes(now, VERIFICATION_TTL_MINUTES);

    if (user.status !== UserStatus.PENDING_VERIFICATION) {
      if (user.status === UserStatus.ACTIVE) {
        void this.mail.sendAccountExistsNotice({ to: user.email, fullName: user.fullName });
      }

      return this.verificationPendingResponse(user.email, fallbackExpiresAt);
    }

    const onCooldown =
      user.verificationSentAt !== null &&
      now.getTime() - user.verificationSentAt.getTime() < RESEND_COOLDOWN_MS;

    if (onCooldown) {
      return this.verificationPendingResponse(
        user.email,
        user.emailVerificationExpiresAt ?? fallbackExpiresAt,
      );
    }

    const code = this.generateVerificationCode();
    const expiresAt = addMinutes(now, VERIFICATION_TTL_MINUTES);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationCodeHash: this.hashVerificationCode(user.email, code),
        emailVerificationExpiresAt: expiresAt,
        emailVerificationAttempts: 0,
        verificationSentAt: now,
      },
    });

    void this.mail.sendEmailVerification({
      to: user.email,
      fullName: user.fullName,
      code,
      expiresAt,
    });

    return this.verificationPendingResponse(user.email, expiresAt, code);
  }

  /**
   * Respuesta unica de /auth/register y /auth/resend-verification. No incluye
   * datos de la cuenta: es identica para un correo nuevo y para uno ya
   * registrado. `devVerificationCode` solo aparece fuera de produccion y con
   * EXPOSE_DEV_CODES=true.
   */
  private verificationPendingResponse(email: string, expiresAt: Date, code?: string) {
    return {
      email,
      verificationRequired: true,
      verificationExpiresAt: expiresAt,
      ...(code && this.canExposeDevCodes() ? { devVerificationCode: code } : {}),
      message: 'Revisa tu correo institucional para continuar con la activacion de tu cuenta.',
    };
  }

  private async invalidateVerificationCode(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { emailVerificationCodeHash: null, emailVerificationExpiresAt: null },
    });
  }

  private attemptsExceeded(): BadRequestException {
    return new BadRequestException({
      code: 'VERIFICATION_ATTEMPTS_EXCEEDED',
      message: `Superaste los ${MAX_VERIFICATION_ATTEMPTS} intentos permitidos. Solicita un codigo nuevo.`,
    });
  }

  /**
   * Comprueba que el programa exista y, si el dominio institucional tiene
   * facultades configuradas en INSTITUTIONAL_DOMAIN_FACULTIES, que el programa
   * pertenezca a una de ellas. Sin configuracion no hay restriccion: el modelo
   * de datos no guarda a que universidad pertenece cada facultad.
   */
  private async assertProgramIsAllowed(email: string, programId?: string): Promise<void> {
    if (!programId) {
      return;
    }

    const program = await this.prisma.program.findUnique({
      where: { id: programId },
      select: { id: true, faculty: { select: { code: true } } },
    });

    if (!program) {
      throw new NotFoundException({
        code: 'PROGRAM_NOT_FOUND',
        message: 'El programa academico indicado no existe',
      });
    }

    const scopes =
      this.config.get<Record<string, string[]>>('institutionalDomainFaculties') ?? {};
    const domain = email.split('@')[1]?.toLowerCase() ?? '';
    const allowedFaculties = scopes[domain];

    if (!allowedFaculties || allowedFaculties.length === 0) {
      return;
    }

    if (!allowedFaculties.includes(program.faculty.code.toUpperCase())) {
      throw new BadRequestException({
        code: 'PROGRAM_NOT_IN_DOMAIN_SCOPE',
        message: `El programa indicado no pertenece a las facultades habilitadas para ${domain}: ${allowedFaculties.join(', ')}`,
      });
    }
  }

  /**
   * Unico error de credenciales del login. No distingue entre correo
   * inexistente, contrasena incorrecta y cuenta bloqueada, para no permitir
   * averiguar que correos estan registrados.
   */
  private invalidCredentials(): UnauthorizedException {
    return new UnauthorizedException({
      code: 'INVALID_CREDENTIALS',
      message: 'Credenciales invalidas',
    });
  }

  private isLocked(user: { lockedUntil: Date | null }): boolean {
    return user.lockedUntil !== null && user.lockedUntil > new Date();
  }

  /**
   * Suma un intento fallido y, al llegar al tope, bloquea la cuenta un rato.
   * Complementa el limite por IP del throttler, que no frena a quien reparte
   * los intentos entre varias direcciones.
   *
   * El contador se reinicia al bloquear, para que al terminar el bloqueo la
   * persona disponga de nuevo de todos los intentos.
   */
  private async registerFailedLogin(user: {
    id: string;
    failedLoginAttempts: number;
  }): Promise<void> {
    const attempts = user.failedLoginAttempts + 1;

    await this.prisma.user.update({
      where: { id: user.id },
      data:
        attempts >= MAX_FAILED_LOGINS
          ? {
              failedLoginAttempts: 0,
              lockedUntil: addMinutes(new Date(), LOGIN_LOCK_MINUTES),
            }
          : { failedLoginAttempts: attempts },
    });
  }

  private assertInstitutionalEmail(email: string): void {
    const domains = this.config.get<string[]>('institutionalEmailDomains') ?? [];
    const domain = email.split('@')[1]?.toLowerCase();

    if (!domain || !domains.includes(domain)) {
      throw new BadRequestException({
        code: 'NON_INSTITUTIONAL_EMAIL',
        message: `El correo debe pertenecer a un dominio institucional: ${domains.join(', ')}`,
      });
    }
  }

  private generateVerificationCode(): string {
    return randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  private hashVerificationCode(email: string, code: string): string {
    const secret = this.config.getOrThrow<string>('security.emailCodeSecret');
    return createHash('sha256').update(`${email}:${code}:${secret}`).digest('hex');
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private safeEqual(first: string, second: string): boolean {
    const firstBuffer = Buffer.from(first);
    const secondBuffer = Buffer.from(second);
    return (
      firstBuffer.length === secondBuffer.length && timingSafeEqual(firstBuffer, secondBuffer)
    );
  }

  private canExposeDevCodes(): boolean {
    return (
      this.config.get<boolean>('exposeDevCodes') === true &&
      this.config.get<string>('nodeEnv') !== 'production'
    );
  }

  private toSafeUser(user: {
    id: string;
    email: string;
    fullName: string;
    role: Role;
    status: UserStatus;
    emailVerifiedAt?: Date | null;
    lastLoginAt?: Date | null;
    createdAt?: Date;
    studentProfile?: {
      studentCode: string | null;
      semester: number | null;
      program: { id: string; name: string; code: string; faculty?: { id: string; name: string; code: string } } | null;
    } | null;
    tutorProfile?: {
      id: string;
      bio: string | null;
      experienceYears: number;
      hourlyRate: { toNumber(): number };
      verificationStatus: string;
      averageRating: number;
      reviewCount: number;
      modalities: string[];
      subjects: Array<{
        id: string;
        status: string;
        subject: { id: string; name: string; code: string };
      }>;
      professors: Array<{ professor: { id: string; fullName: string } }>;
    } | null;
  }) {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      status: user.status,
      emailVerifiedAt: user.emailVerifiedAt ?? null,
      lastLoginAt: user.lastLoginAt ?? null,
      createdAt: user.createdAt ?? null,
      studentProfile: user.studentProfile
        ? {
            studentCode: user.studentProfile.studentCode,
            semester: user.studentProfile.semester,
            program: user.studentProfile.program,
          }
        : null,
      tutorProfile: user.tutorProfile
        ? {
            id: user.tutorProfile.id,
            bio: user.tutorProfile.bio,
            experienceYears: user.tutorProfile.experienceYears,
            hourlyRate: money(user.tutorProfile.hourlyRate),
            verificationStatus: user.tutorProfile.verificationStatus,
            averageRating: Number(user.tutorProfile.averageRating.toFixed(2)),
            reviewCount: user.tutorProfile.reviewCount,
            modalities: user.tutorProfile.modalities,
            subjects: user.tutorProfile.subjects,
            professors: user.tutorProfile.professors.map((link) => link.professor),
          }
        : null,
    };
  }
}
