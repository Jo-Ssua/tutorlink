import { describe, expect, it } from 'vitest';
import {
  INSTITUTIONAL_DOMAINS,
  acceptedEmailFormat,
  isInstitutionalEmail,
} from './institutionalEmail';

describe('correo institucional', () => {
  it('acepta los dominios configurados sin importar mayusculas ni espacios', () => {
    expect(isInstitutionalEmail('ana.torres@universidad.edu.co')).toBe(true);
    expect(isInstitutionalEmail('  Ana.Torres@Universidad.Edu.Co  ')).toBe(true);
    expect(isInstitutionalEmail('juan@estudiantes.universidad.edu.co')).toBe(true);
  });

  it('rechaza correos de otros dominios', () => {
    expect(isInstitutionalEmail('ana@gmail.com')).toBe(false);
    expect(isInstitutionalEmail('ana@otra.edu.co')).toBe(false);
    // Un dominio que solo termina parecido no cuenta.
    expect(isInstitutionalEmail('ana@falsa-universidad.edu.co')).toBe(false);
  });

  it('rechaza lo que no es un correo', () => {
    expect(isInstitutionalEmail('')).toBe(false);
    expect(isInstitutionalEmail('ana.torres')).toBe(false);
    expect(isInstitutionalEmail('ana@')).toBe(false);
    expect(isInstitutionalEmail('@universidad.edu.co')).toBe(false);
  });

  it('enumera el formato aceptado para mostrarselo al usuario', () => {
    const format = acceptedEmailFormat();

    for (const domain of INSTITUTIONAL_DOMAINS) {
      expect(format).toContain(`@${domain}`);
    }
  });
});
