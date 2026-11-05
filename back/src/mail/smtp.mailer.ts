import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Transporter, createTransport } from 'nodemailer';
import { MailSmtpConfiguration } from '../config/configuration';
import { MailMessage, MailerPort } from './mailer.port';

@Injectable()
export class SmtpMailer extends MailerPort implements OnModuleDestroy {
  private readonly logger = new Logger(SmtpMailer.name);
  private readonly from: string;
  private readonly transporter: Transporter;

  constructor(config: ConfigService) {
    super();
    const smtp = config.getOrThrow<MailSmtpConfiguration>('mail.smtp');
    this.from = config.getOrThrow<string>('mail.from');
    this.transporter = createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      ...(smtp.user ? { auth: { user: smtp.user, pass: smtp.pass } } : {}),
    });

    this.logger.log(`Transporte SMTP configurado en ${smtp.host}:${smtp.port}`);
  }

  async send(message: MailMessage): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  }

  onModuleDestroy(): void {
    this.transporter.close();
  }
}
