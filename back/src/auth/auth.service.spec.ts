import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash } from 'crypto';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

const UUID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const EMAIL = 'ana.torres@universidad.edu.co';
const PASSWORD = 'Segura123';
/** Coste 4 en vez de 12: el spec no mide la fuerza del hash, solo la logica. */
const PASSWORD_HASH = bcrypt.hashSync(PASSWORD, 4);
const CODE_SECRET = 'email-code-secret';

const CONFIG: Record<string, unknown> = {
  institutionalEmailDomains: ['universidad.edu.co', 'estudiantes.universidad.edu.co'],
  institutionalDomainFaculties: {},
  exposeDevCodes: true,
  nodeEnv: 'test',
  'security.emailCodeSecret': CODE_SECRET,
  'jwt.accessSecret': 'access-secret',
  'jwt.refreshSecret': 'refresh-secret',
  'jwt.accessExpiresIn': '15m',
  'jwt.refreshExpiresIn': '7d',
};

/** El mismo hash que guarda el servicio para el codigo de verificacion. */
function codeHash(email: string, code: string): string {
  return createHash('sha256').update(`${email}:${code}:${CODE_SECRET}`).digest('hex');
}

interface PrismaMock {
  user: {
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  program: { findUnique: jest.Mock };
  notification: { create: jest.Mock };
}

interface MailMock {
  sendEmailVerification: jest.Mock;
  sendAccountExistsNotice: jest.Mock;
}

function buildService(overrides: { user?: unknown; config?: Record<string, unknown> } = {}) {
  const prisma: PrismaMock = {
    user: {
      findUnique: jest.fn().mockResolvedValue(overrides.user ?? null),
      create: jest.fn().mockResolvedValue({ email: EMAIL, fullName: 'Ana Torres' }),
      update: jest.fn().mockImplementation(({ data }: { data: unknown }) => ({
        id: UUID(1),
        email: EMAIL,
        role: Role.STUDENT,
        status: UserStatus.ACTIVE,
        ...(data as object),
      })),
    },
    program: { findUnique: jest.fn().mockResolvedValue(null) },
    notification: { create: jest.fn().mockResolvedValue({}) },
  };

  const mail: MailMock = {
    sendEmailVerification: jest.fn().mockResolvedValue(undefined),
    sendAccountExistsNotice: jest.fn().mockResolvedValue(undefined),
  };

  const values = { ...CONFIG, ...overrides.config };
  const config = {
    get: (key: string) => values[key],
    getOrThrow: (key: string) => {
      if (values[key] === undefined) throw new Error(`Falta la clave ${key}`);
      return values[key];
    },
  } as unknown as ConfigService;

  const jwt = {
    signAsync: jest.fn((payload: { type: string }) => Promise.resolve(`${payload.type}-token`)),
  } as unknown as JwtService;

  const service = new AuthService(
    prisma as unknown as PrismaService,
    jwt,
    config,
    mail as unknown as MailService,
  );

  return { service, prisma, mail, jwt };
}

/** Cuenta lista para iniciar sesion, con lo que incluye `login`. */
function activeUser(extra: Record<string, unknown> = {}) {
  return {
    id: UUID(1),
    email: EMAIL,
    passwordHash: PASSWORD_HASH,
    fullName: 'Ana Torres',
    role: Role.STUDENT,
    status: UserStatus.ACTIVE,
    tokenVersion: 3,
    failedLoginAttempts: 0,
    lockedUntil: null,
    emailVerifiedAt: new Date(),
    lastLoginAt: null,
    createdAt: new Date(),
    studentProfile: null,
    tutorProfile: null,
    ...extra,
  };
}

describe('AuthService · registro con correo institucional', () => {
  it('rechaza un correo no institucional e informa los dominios aceptados', async () => {
    const { service, prisma } = buildService();

    await expect(
      service.register({ email: 'ana@gmail.com', password: PASSWORD, fullName: 'Ana' }),
    ).rejects.toMatchObject({
      response: {
        code: 'NON_INSTITUTIONAL_EMAIL',
        message: expect.stringContaining('universidad.edu.co'),
      },
    });

    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('crea la cuenta, envia el codigo de 6 digitos y no devuelve datos de la cuenta', async () => {
    const { service, prisma, mail } = buildService();

    const result = await service.register({
      email: EMAIL,
      password: PASSWORD,
      fullName: 'Ana Torres',
    });

    expect(prisma.user.create).toHaveBeenCalledTimes(1);
    const created = prisma.user.create.mock.calls[0][0].data;
    expect(created.status).toBe(UserStatus.PENDING_VERIFICATION);
    // La contrasena nunca se guarda en claro.
    expect(created.passwordHash).not.toBe(PASSWORD);
    await expect(bcrypt.compare(PASSWORD, created.passwordHash)).resolves.toBe(true);

    const sent = mail.sendEmailVerification.mock.calls[0][0];
    expect(sent.to).toBe(EMAIL);
    expect(sent.code).toMatch(/^\d{6}$/);
    // El hash guardado corresponde al codigo enviado por correo.
    expect(created.emailVerificationCodeHash).toBe(codeHash(EMAIL, sent.code));

    expect(result).toMatchObject({ email: EMAIL, verificationRequired: true });
    expect(result).not.toHaveProperty('user');
  });

  it('responde igual para un correo ya registrado y solo avisa por correo', async () => {
    const { service, prisma, mail } = buildService({
      user: {
        id: UUID(1),
        email: EMAIL,
        fullName: 'Ana Torres',
        status: UserStatus.ACTIVE,
        verificationSentAt: null,
        emailVerificationExpiresAt: null,
      },
    });

    const result = await service.register({
      email: EMAIL,
      password: 'OtraClave123',
      fullName: 'Impostor',
    });

    // Misma forma que un registro nuevo: nada delata que la cuenta existe.
    expect(Object.keys(result).sort()).toEqual(
      ['email', 'message', 'verificationExpiresAt', 'verificationRequired'].sort(),
    );
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(mail.sendEmailVerification).not.toHaveBeenCalled();
    expect(mail.sendAccountExistsNotice).toHaveBeenCalledWith({
      to: EMAIL,
      fullName: 'Ana Torres',
    });
  });

  it('no reenvia el codigo si el anterior salio hace menos de un minuto', async () => {
    const { service, prisma, mail } = buildService({
      user: {
        id: UUID(1),
        email: EMAIL,
        fullName: 'Ana Torres',
        status: UserStatus.PENDING_VERIFICATION,
        verificationSentAt: new Date(Date.now() - 10_000),
        emailVerificationExpiresAt: new Date(Date.now() + 600_000),
      },
    });

    const result = await service.resendVerification({ email: EMAIL });

    expect(mail.sendEmailVerification).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(result.verificationRequired).toBe(true);
  });

  it('responde igual al reenviar a un correo que no existe', async () => {
    const { service, mail } = buildService();

    const result = await service.resendVerification({ email: EMAIL });

    expect(result).toMatchObject({ email: EMAIL, verificationRequired: true });
    expect(mail.sendEmailVerification).not.toHaveBeenCalled();
  });
});

describe('AuthService · verificacion del codigo', () => {
  const code = '123456';

  function pendingUser(extra: Record<string, unknown> = {}) {
    return {
      id: UUID(1),
      role: Role.STUDENT,
      status: UserStatus.PENDING_VERIFICATION,
      emailVerificationCodeHash: codeHash(EMAIL, code),
      emailVerificationExpiresAt: new Date(Date.now() + 600_000),
      emailVerificationAttempts: 0,
      ...extra,
    };
  }

  it('activa la cuenta con el codigo correcto', async () => {
    const { service, prisma } = buildService({ user: pendingUser() });

    const result = await service.verifyEmail({ email: EMAIL, code });

    expect(result.verified).toBe(true);
    const update = prisma.user.update.mock.calls[0][0].data;
    expect(update.status).toBe(UserStatus.ACTIVE);
    // El codigo se consume: no sirve dos veces.
    expect(update.emailVerificationCodeHash).toBeNull();
    expect(prisma.notification.create).toHaveBeenCalledTimes(1);
  });

  it('suma el intento fallido y dice cuantos quedan', async () => {
    const { service, prisma } = buildService({ user: pendingUser() });

    await expect(service.verifyEmail({ email: EMAIL, code: '000000' })).rejects.toMatchObject({
      response: {
        code: 'INVALID_VERIFICATION_CODE',
        details: ['Intentos restantes: 4'],
      },
    });

    expect(prisma.user.update.mock.calls[0][0].data.emailVerificationAttempts).toBe(1);
  });

  it('invalida el codigo al agotar los cinco intentos', async () => {
    const { service, prisma } = buildService({
      user: pendingUser({ emailVerificationAttempts: 4 }),
    });

    await expect(service.verifyEmail({ email: EMAIL, code: '000000' })).rejects.toMatchObject({
      response: { code: 'VERIFICATION_ATTEMPTS_EXCEEDED' },
    });

    expect(prisma.user.update.mock.calls[0][0].data).toMatchObject({
      emailVerificationAttempts: 5,
      emailVerificationCodeHash: null,
    });
  });

  it('rechaza un codigo vencido', async () => {
    const { service } = buildService({
      user: pendingUser({ emailVerificationExpiresAt: new Date(Date.now() - 1_000) }),
    });

    await expect(service.verifyEmail({ email: EMAIL, code })).rejects.toMatchObject({
      response: { code: 'VERIFICATION_CODE_EXPIRED' },
    });
  });

  it('avisa que la cuenta ya estaba verificada', async () => {
    const { service } = buildService({ user: pendingUser({ status: UserStatus.ACTIVE }) });

    await expect(service.verifyEmail({ email: EMAIL, code })).rejects.toMatchObject({
      response: { code: 'EMAIL_ALREADY_VERIFIED' },
    });
  });
});

describe('AuthService · inicio y cierre de sesion', () => {
  it('entrega tokens con una cuenta activa y credenciales validas', async () => {
    const { service, prisma } = buildService({ user: activeUser() });

    const result = await service.login({ email: EMAIL, password: PASSWORD });

    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toBe('refresh-token');
    expect(result.user.email).toBe(EMAIL);
    // La respuesta nunca incluye el hash de la contrasena.
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(prisma.user.update).toHaveBeenCalled();
  });

  it('da el mismo error para un correo que no existe', async () => {
    const { service } = buildService();

    await expect(service.login({ email: EMAIL, password: PASSWORD })).rejects.toMatchObject({
      response: { code: 'INVALID_CREDENTIALS', message: 'Credenciales invalidas' },
    });
  });

  it('da el mismo error con la contrasena incorrecta y suma el intento', async () => {
    const { service, prisma } = buildService({ user: activeUser() });

    const failure = service.login({ email: EMAIL, password: 'NoEsLaClave1' });
    await expect(failure).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(failure).rejects.toMatchObject({
      response: { code: 'INVALID_CREDENTIALS' },
    });

    expect(prisma.user.update.mock.calls[0][0].data).toEqual({ failedLoginAttempts: 1 });
  });

  it('bloquea la cuenta al quinto intento fallido', async () => {
    const { service, prisma } = buildService({
      user: activeUser({ failedLoginAttempts: 4 }),
    });

    await expect(service.login({ email: EMAIL, password: 'NoEsLaClave1' })).rejects.toMatchObject({
      response: { code: 'INVALID_CREDENTIALS' },
    });

    const data = prisma.user.update.mock.calls[0][0].data;
    expect(data.failedLoginAttempts).toBe(0);
    expect(data.lockedUntil.getTime()).toBeGreaterThan(Date.now());
  });

  it('no revela el bloqueo aunque la contrasena sea correcta', async () => {
    const { service } = buildService({
      user: activeUser({ lockedUntil: new Date(Date.now() + 600_000) }),
    });

    await expect(service.login({ email: EMAIL, password: PASSWORD })).rejects.toMatchObject({
      response: { code: 'INVALID_CREDENTIALS' },
    });
  });

  it('pide verificar el correo solo cuando la contrasena es correcta', async () => {
    const { service } = buildService({
      user: activeUser({ status: UserStatus.PENDING_VERIFICATION, emailVerifiedAt: null }),
    });

    const failure = service.login({ email: EMAIL, password: PASSWORD });
    await expect(failure).rejects.toBeInstanceOf(ForbiddenException);
    await expect(failure).rejects.toMatchObject({
      response: { code: 'EMAIL_NOT_VERIFIED' },
    });
  });

  it('reinicia el contador de fallos tras un inicio de sesion correcto', async () => {
    const { service, prisma } = buildService({ user: activeUser({ failedLoginAttempts: 3 }) });

    await service.login({ email: EMAIL, password: PASSWORD });

    expect(prisma.user.update.mock.calls[0][0].data).toEqual({
      failedLoginAttempts: 0,
      lockedUntil: null,
    });
  });

  it('cierra la sesion borrando el refresh token e invalidando los access tokens', async () => {
    const { service, prisma } = buildService({ user: activeUser() });

    const result = await service.logout(UUID(1));

    expect(result.loggedOut).toBe(true);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: UUID(1) },
      data: { refreshTokenHash: null, tokenVersion: { increment: 1 } },
    });
  });

  it('firma el access token con la version de sesion vigente', async () => {
    const { service, jwt } = buildService({ user: activeUser({ tokenVersion: 7 }) });

    await service.login({ email: EMAIL, password: PASSWORD });

    const [payload] = (jwt.signAsync as jest.Mock).mock.calls[0];
    expect(payload).toMatchObject({ type: 'access', tv: 7 });
  });
});

describe('AuthService · codigos de desarrollo', () => {
  it('no expone el codigo cuando EXPOSE_DEV_CODES esta apagado', async () => {
    const { service } = buildService({ config: { exposeDevCodes: false } });

    const result = await service.register({
      email: EMAIL,
      password: PASSWORD,
      fullName: 'Ana Torres',
    });

    expect(result).not.toHaveProperty('devVerificationCode');
  });

  it('no expone el codigo en produccion ni con la bandera encendida', async () => {
    const { service } = buildService({
      config: { exposeDevCodes: true, nodeEnv: 'production' },
    });

    const result = await service.register({
      email: EMAIL,
      password: PASSWORD,
      fullName: 'Ana Torres',
    });

    expect(result).not.toHaveProperty('devVerificationCode');
  });
});
