import { MailMessage } from '../mailer.port';
import { escapeHtml, layout } from './html';

export interface AccountExistsEmailInput {
  fullName: string;
  /** Pantalla de inicio de sesion del frontend. */
  loginUrl: string;
}

/**
 * Se envia cuando alguien intenta registrarse con un correo que ya tiene cuenta
 * activa. La API responde lo mismo que en un registro nuevo, asi que este correo
 * es el unico canal que distingue los dos casos y solo llega al dueno del buzon.
 */
export function buildAccountExistsEmail(
  input: AccountExistsEmailInput,
): Omit<MailMessage, 'to'> {
  const firstName = input.fullName.trim().split(/\s+/)[0] ?? '';

  const text = [
    `Hola ${firstName},`,
    '',
    'Recibimos un intento de registro con este correo institucional, pero ya tienes una cuenta activa en TutorLink.',
    '',
    `Inicia sesion aqui: ${input.loginUrl}`,
    '',
    'Si no fuiste tu, no tienes que hacer nada: no se creo ninguna cuenta nueva.',
  ].join('\n');

  const html = layout(
    'Ya tienes una cuenta en TutorLink',
    [
      `<p style="margin:0 0 16px;font-size:16px;">Hola ${escapeHtml(firstName)},</p>`,
      '<p style="margin:0 0 24px;font-size:15px;line-height:1.6;">Recibimos un intento de registro con este correo institucional, pero ya tienes una cuenta activa en TutorLink.</p>',
      `<p style="margin:0 0 24px;"><a href="${escapeHtml(input.loginUrl)}" style="display:inline-block;background:#2b59ff;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:15px;font-weight:600;">Iniciar sesion</a></p>`,
      '<p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;">Si no fuiste tu, no tienes que hacer nada: no se creo ninguna cuenta nueva.</p>',
    ].join(''),
  );

  return { subject: 'Ya tienes una cuenta en TutorLink', text, html };
}
