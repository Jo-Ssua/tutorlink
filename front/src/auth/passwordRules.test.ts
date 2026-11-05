import { describe, expect, it } from 'vitest';
import { isPasswordValid, passwordRules, passwordScore } from './passwordRules';

describe('reglas de contrasena', () => {
  it('acepta una contrasena que cumple las cuatro reglas', () => {
    expect(isPasswordValid('Segura123')).toBe(true);
    expect(passwordScore('Segura123')).toBe(4);
  });

  it('senala exactamente la regla que falta', () => {
    const faltaMayuscula = passwordRules('segura123').filter((rule) => !rule.met);
    expect(faltaMayuscula).toHaveLength(1);
    expect(faltaMayuscula[0].label).toMatch(/mayúscula/i);

    const faltaNumero = passwordRules('SeguraClave').filter((rule) => !rule.met);
    expect(faltaNumero).toHaveLength(1);
    expect(faltaNumero[0].label).toMatch(/número/i);
  });

  it('rechaza contrasenas cortas y las de mas de 72 caracteres', () => {
    expect(isPasswordValid('Corta1')).toBe(false);
    // 72 es el tope de bcrypt y el maximo del RegisterDto.
    expect(isPasswordValid(`Aa1${'x'.repeat(69)}`)).toBe(true);
    expect(isPasswordValid(`Aa1${'x'.repeat(70)}`)).toBe(false);
  });

  it('cuenta las reglas cumplidas para la barra de fuerza', () => {
    expect(passwordScore('')).toBe(0);
    expect(passwordScore('abc')).toBe(1);
    expect(passwordScore('abcdefgh')).toBe(2);
    expect(passwordScore('Abcdefgh')).toBe(3);
  });
});
