/** Mensaje listo para enviar: el remitente lo define cada transporte. */
export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Puerto de salida de correo. Se usa como token de inyeccion para que el
 * transporte real (SMTP) y el de desarrollo (consola) sean intercambiables,
 * y para que las pruebas puedan inyectar un doble.
 */
export abstract class MailerPort {
  abstract send(message: MailMessage): Promise<void>;
}
