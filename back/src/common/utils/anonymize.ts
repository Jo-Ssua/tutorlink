import { createHash } from 'crypto';

export function anonymizeStudentId(studentId: string, salt: string): string {
  const digest = createHash('sha256')
    .update(`${salt}:${studentId}`)
    .digest('hex')
    .slice(0, 6)
    .toUpperCase();

  return `Estudiante #${digest}`;
}
