import { differenceInMinutes, formatDateTime } from '../../common/utils/date';
import { MailMessage } from '../mailer.port';
import { escapeHtml, layout } from './html';

export interface VerificationEmailInput {
  fullName: string;
  /** Codigo de 6 digitos. */
  code: string;
  /** Enlace que verifica la cuenta sin escribir el codigo. */
  verificationUrl: string;
  expiresAt: Date;
}

/**
 * Correo de verificacion de cuenta. Incluye las dos vias que acepta la API:
 * el codigo de 6 digitos y el enlace directo.
 */
export function buildVerificationEmail(
  input: VerificationEmailInput,
): Omit<MailMessage, 'to'> {
  const minutes = Math.max(differenceInMinutes(new Date(), input.expiresAt), 1);
  const firstName = input.fullName.trim().split(/\s+/)[0] ?? '';

  const text = [
    `Hola ${firstName},`,
    '',
    'Confirma tu correo institucional para activar tu cuenta de TutorLink.',
    '',
    `Codigo de verificacion: ${input.code}`,
    `Tambien puedes abrir este enlace: ${input.verificationUrl}`,
    '',
    `El codigo vence en ${minutes} minutos (${formatDateTime(input.expiresAt)}).`,
    'Si no creaste esta cuenta, ignora este correo.',
  ].join('\n');

  const html = layout(
    'Verifica tu correo institucional',
    [
      `<p style="margin:0 0 16px;font-size:16px;">Hola ${escapeHtml(firstName)},</p>`,
      '<p style="margin:0 0 24px;font-size:15px;line-height:1.6;">Confirma tu correo institucional para activar tu cuenta de TutorLink.</p>',
      '<p style="margin:0 0 8px;font-size:13px;color:#6b7280;">Tu codigo de verificacion</p>',
      `<p style="margin:0 0 24px;font-size:32px;font-weight:700;letter-spacing:0.18em;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${escapeHtml(input.code)}</p>`,
      `<p style="margin:0 0 24px;"><a href="${escapeHtml(input.verificationUrl)}" style="display:inline-block;background:#2b59ff;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:15px;font-weight:600;">Verificar mi cuenta</a></p>`,
      `<p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;">El codigo vence en ${minutes} minutos (${escapeHtml(formatDateTime(input.expiresAt))}).</p>`,
    ].join(''),
  );

  return { subject: 'Verifica tu correo institucional de TutorLink', text, html };
}
