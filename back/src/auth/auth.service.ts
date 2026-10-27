import { createHash, randomInt, timingSafeEqual } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { Role, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
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

interface TokenPayload {
  sub: string;
  email: string;
  role: Role;
  type: 'access' | 'refresh';
  jti?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    this.assertInstitutionalEmail(dto.email);

    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true, status: true },
    });

    if (existing) {
      throw new ConflictException({
        code: 'EMAIL_ALREADY_REGISTERED',
        message: 'Ya existe una cuenta con el correo institucional indicado',
      });
    }

    if (dto.programId) {
      const program = await this.prisma.program.findUnique({ where: { id: dto.programId } });
      if (!program) {
        throw new NotFoundException({
          code: 'PROGRAM_NOT_FOUND',
          message: 'El programa academico indicado no existe',
        });
      }
    }

    const verificationCode = this.generateVerificationCode();
    const verificationExpiresAt = addMinutes(new Date(), 15);
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
      select: { id: true, email: true, fullName: true, role: true, status: true },
    });

    return {
      user,
      verificationRequired: true,
      verificationExpiresAt,
      ...(this.canExposeDevCodes() ? { devVerificationCode: verificationCode } : {}),
      message:
        'Cuenta creada. Confirma el codigo enviado al correo institucional para activarla.',
    };
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
      },
    });

    if (!user || !user.emailVerificationCodeHash) {
      throw new BadRequestException({
        code: 'INVALID_VERIFICATION_CODE',
        message: 'El codigo de verificacion no es valido',
      });
    }

    if (user.status === UserStatus.ACTIVE) {
      throw new ConflictException({
        code: 'EMAIL_ALREADY_VERIFIED',
        message: 'La cuenta ya se encuentra verificada',
      });
    }

    if (!user.emailVerificationExpiresAt || user.emailVerificationExpiresAt < new Date()) {
      throw new BadRequestException({
        code: 'VERIFICATION_CODE_EXPIRED',
        message: 'El codigo de verificacion expiro. Solicita uno nuevo.',
      });
    }

    const expected = this.hashVerificationCode(dto.email, dto.code);
    if (!this.safeEqual(expected, user.emailVerificationCodeHash)) {
      throw new BadRequestException({
        code: 'INVALID_VERIFICATION_CODE',
        message: 'El codigo de verificacion no es valido',
      });
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        emailVerificationCodeHash: null,
        emailVerificationExpiresAt: null,
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
      select: { id: true, status: true, verificationSentAt: true },
    });

    if (!user) {
      return {
        sent: true,
        message: 'Si el correo esta registrado, recibiras un nuevo codigo de verificacion.',
      };
    }

    if (user.status === UserStatus.ACTIVE) {
      throw new ConflictException({
        code: 'EMAIL_ALREADY_VERIFIED',
        message: 'La cuenta ya se encuentra verificada',
      });
    }

    if (user.verificationSentAt && Date.now() - user.verificationSentAt.getTime() < 60_000) {
      throw new HttpException(
        {
          code: 'VERIFICATION_COOLDOWN',
          message: 'Espera al menos 60 segundos antes de solicitar otro codigo',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const code = this.generateVerificationCode();
    const expiresAt = addMinutes(new Date(), 15);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationCodeHash: this.hashVerificationCode(dto.email, code),
        emailVerificationExpiresAt: expiresAt,
        verificationSentAt: new Date(),
      },
    });

    return {
      sent: true,
      verificationExpiresAt: expiresAt,
      ...(this.canExposeDevCodes() ? { devVerificationCode: code } : {}),
      message: 'Se genero un nuevo codigo de verificacion.',
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: {
        studentProfile: { include: { program: true } },
        tutorProfile: {
          include: {
            subjects: { include: { subject: true } },
            professors: { include: { professor: true } },
          },
        },
      },
    });

    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Credenciales invalidas',
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
      include: {
        studentProfile: { include: { program: true } },
        tutorProfile: {
          include: {
            subjects: { include: { subject: true } },
            professors: { include: { professor: true } },
          },
        },
      },
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException({
        code: 'ACCOUNT_NOT_ACTIVE',
        message: 'La cuenta no esta activa',
      });
    }

    const receivedHash = this.hashToken(dto.refreshToken);
    if (!user.refreshTokenHash || !this.safeEqual(receivedHash, user.refreshTokenHash)) {
      throw new UnauthorizedException({
        code: 'REFRESH_TOKEN_REVOKED',
        message: 'El refresh token fue revocado. Inicia sesion nuevamente.',
      });
    }

    const tokens = await this.issueTokens(user);
    return { ...tokens, user: this.toSafeUser(user) };
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });

    return { loggedOut: true, message: 'Sesion cerrada correctamente' };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        studentProfile: { include: { program: { include: { faculty: true } } } },
        tutorProfile: {
          include: {
            subjects: { include: { subject: true } },
            professors: { include: { professor: true } },
          },
        },
      },
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
      { sub: user.id, email: user.email, role: user.role, type: 'access' },
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
