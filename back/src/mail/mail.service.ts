import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailMessage, MailerPort } from './mailer.port';
import { buildAccountExistsEmail } from './templates/account-exists';
import { buildVerificationEmail } from './templates/verify-email';

export interface SendEmailVerificationInput {
  to: string;
  fullName: string;
  code: string;
  expiresAt: Date;
}

export interface SendAccountExistsNoticeInput {
  to: string;
  fullName: string;
}

/**
 * Capa de aplicacion del correo: arma las plantillas y entrega al transporte.
 *
 * Ninguno de sus metodos rechaza. Un SMTP caido no debe tumbar el registro ni
 * el reenvio de codigo, asi que el fallo se registra en el log y el flujo HTTP
 * continua. Los llamadores invocan con `void` para no esperar la entrega.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    private readonly mailer: MailerPort,
    private readonly config: ConfigService,
  ) {}

  async sendEmailVerification(input: SendEmailVerificationInput): Promise<void> {
    const message = buildVerificationEmail({
      fullName: input.fullName,
      code: input.code,
      expiresAt: input.expiresAt,
      verificationUrl: this.buildUrl(this.config.getOrThrow<string>('mail.verificationPath'), {
        email: input.to,
        code: input.code,
      }),
    });

    await this.deliver(input.to, message);
  }

  async sendAccountExistsNotice(input: SendAccountExistsNoticeInput): Promise<void> {
    const message = buildAccountExistsEmail({
      fullName: input.fullName,
      loginUrl: this.buildUrl(this.config.getOrThrow<string>('mail.loginPath')),
    });

    await this.deliver(input.to, message);
  }

  private async deliver(to: string, message: Omit<MailMessage, 'to'>): Promise<void> {
    try {
      await this.mailer.send({ ...message, to });
      this.logger.log(`Correo "${message.subject}" enviado a ${this.mask(to)}`);
    } catch (error) {
      this.logger.error(
        `No fue posible enviar "${message.subject}" a ${this.mask(to)}: ${
          error instanceof Error ? error.message : 'error desconocido'
        }`,
      );
    }
  }

  private buildUrl(path: string, params: Record<string, string> = {}): string {
    const url = new URL(path, this.config.getOrThrow<string>('appUrl'));
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    return url.toString();
  }

  /** Oculta el buzon en los logs: a****@universidad.edu.co */
  private mask(email: string): string {
    const [local, domain] = email.split('@');
    if (!domain || !local) {
      return '***';
    }

    return `${local.slice(0, 1)}${'*'.repeat(Math.max(local.length - 1, 1))}@${domain}`;
  }
}
