import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailMessage, MailerPort } from './mailer.port';

/**
 * Transporte de desarrollo y CI: no envia nada, escribe el correo en el log.
 * Permite probar el flujo completo de verificacion sin credenciales SMTP.
 */
@Injectable()
export class ConsoleMailer extends MailerPort {
  private readonly logger = new Logger(ConsoleMailer.name);
  private readonly from: string;

  constructor(config: ConfigService) {
    super();
    this.from = config.getOrThrow<string>('mail.from');
  }

  send(message: MailMessage): Promise<void> {
    this.logger.log(
      [
        '',
        '----- Correo simulado (MAIL_TRANSPORT=console) -----',
        `De: ${this.from}`,
        `Para: ${message.to}`,
        `Asunto: ${message.subject}`,
        '',
        message.text,
        '----------------------------------------------------',
      ].join('\n'),
    );

    return Promise.resolve();
  }
}
