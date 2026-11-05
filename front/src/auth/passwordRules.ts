export interface PasswordRule {
  label: string;
  met: boolean;
}

/** Las mismas reglas que valida el backend en RegisterDto. */
export function passwordRules(value: string): PasswordRule[] {
  return [
    { label: 'Al menos 8 caracteres', met: value.length >= 8 && value.length <= 72 },
    { label: 'Una minúscula', met: /[a-z]/.test(value) },
    { label: 'Una mayúscula', met: /[A-Z]/.test(value) },
    { label: 'Un número', met: /\d/.test(value) },
  ];
}

export function isPasswordValid(value: string): boolean {
  return passwordRules(value).every((rule) => rule.met);
}

/** Reglas cumplidas, para la barra de fuerza. */
export function passwordScore(value: string): number {
  return passwordRules(value).filter((rule) => rule.met).length;
}
