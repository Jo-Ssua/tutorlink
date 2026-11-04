const FALLBACK_DOMAINS = 'universidad.edu.co,estudiantes.universidad.edu.co';

/**
 * Dominios institucionales aceptados. Tienen que coincidir con
 * INSTITUTIONAL_EMAIL_DOMAINS del backend, que es quien decide de verdad: esta
 * lista solo sirve para avisar antes de enviar el formulario.
 */
export const INSTITUTIONAL_DOMAINS = (
  import.meta.env.VITE_INSTITUTIONAL_DOMAINS ?? FALLBACK_DOMAINS
)
  .split(',')
  .map((domain) => domain.trim().toLowerCase())
  .filter(Boolean);

export function isInstitutionalEmail(email: string): boolean {
  const domain = email.trim().toLowerCase().split('@')[1];
  return domain !== undefined && INSTITUTIONAL_DOMAINS.includes(domain);
}

/** Texto para mostrar el formato aceptado, antes y después de enviar. */
export function acceptedEmailFormat(): string {
  return INSTITUTIONAL_DOMAINS.map((domain) => `@${domain}`).join(' o ');
}
