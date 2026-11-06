import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConsoleMailer } from './console.mailer';
import { MailService } from './mail.service';
import { MailerPort } from './mailer.port';
import { SmtpMailer } from './smtp.mailer';

@Module({
  providers: [
    {
      provide: MailerPort,
      inject: [ConfigService],
      useFactory: (config: ConfigService): MailerPort =>
        config.getOrThrow<string>('mail.transport') === 'smtp'
          ? new SmtpMailer(config)
          : new ConsoleMailer(config),
    },
    MailService,
  ],
  exports: [MailService, MailerPort],
})
export class MailModule {}
