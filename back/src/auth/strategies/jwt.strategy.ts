import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Role, UserStatus } from '@prisma/client';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { PrismaService } from '../../prisma/prisma.service';

interface AccessTokenPayload {
  sub: string;
  email: string;
  role: Role;
  type: 'access' | 'refresh';
  /** Version de sesion con la que se firmo el token. */
  tv: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('jwt.accessSecret'),
    });
  }

  async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    if (payload.type !== 'access') {
      throw new UnauthorizedException({
        code: 'INVALID_ACCESS_TOKEN',
        message: 'El token indicado no es un access token',
      });
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        tokenVersion: true,
      },
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException({
        code: 'ACCOUNT_NOT_ACTIVE',
        message: 'La cuenta no existe o no esta activa',
      });
    }

    // Al cerrar sesion la cuenta sube de version: los tokens firmados con la
    // anterior dejan de servir aunque todavia no hayan expirado.
    if (payload.tv !== user.tokenVersion) {
      throw new UnauthorizedException({
        code: 'TOKEN_REVOKED',
        message: 'La sesion se cerro. Inicia sesion nuevamente.',
      });
    }

    const { tokenVersion: _tokenVersion, ...authenticated } = user;

    return authenticated;
  }
}
