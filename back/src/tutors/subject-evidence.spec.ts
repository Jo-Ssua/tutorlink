import { BadRequestException } from '@nestjs/common';
import { assertSubjectCanBeRegistered, SubjectEvidenceInput } from './subject-evidence';

function errorCode(input: SubjectEvidenceInput): string {
  try {
    assertSubjectCanBeRegistered(input, 'SIS201');
    throw new Error('Se esperaba un rechazo');
  } catch (error) {
    if (!(error instanceof BadRequestException)) throw error;
    const response = error.getResponse();
    if (typeof response === 'object' && response && 'code' in response) {
      return String(response.code);
    }
    return '';
  }
}

describe('assertSubjectCanBeRegistered', () => {
  it('acepta solo la evidencia de aprobacion', () => {
    expect(
      assertSubjectCanBeRegistered(
        { evidenceUrl: '  https://example.com/nota.pdf  ' },
        'SIS201',
      ),
    ).toEqual({
      evidenceUrl: 'https://example.com/nota.pdf',
      grade: null,
      approvedSemester: null,
    });
  });

  it('acepta la nota y el semestre cuando no hay archivo', () => {
    expect(
      assertSubjectCanBeRegistered({ grade: 4.5, approvedSemester: 4 }, 'SIS201'),
    ).toEqual({
      evidenceUrl: null,
      grade: '4.50',
      approvedSemester: 4,
    });
  });

  it('conserva evidencia y datos de validacion cuando ambos son validos', () => {
    expect(
      assertSubjectCanBeRegistered(
        {
          evidenceUrl: 'https://example.com/nota.pdf',
          grade: 3,
          approvedSemester: 2,
        },
        'SIS201',
      ),
    ).toEqual({
      evidenceUrl: 'https://example.com/nota.pdf',
      grade: '3.00',
      approvedSemester: 2,
    });
  });

  it('rechaza una materia sin evidencia ni datos de validacion', () => {
    expect(errorCode({ evidenceUrl: '   ' })).toBe('SUBJECT_EVIDENCE_REQUIRED');
  });

  it('rechaza una nota que no corresponde a una materia aprobada', () => {
    expect(errorCode({ grade: 2.9, approvedSemester: 3 })).toBe('SUBJECT_NOT_APPROVED');
  });

  it('exige nota y semestre juntos', () => {
    expect(errorCode({ grade: 4 })).toBe('SUBJECT_VALIDATION_INCOMPLETE');
    expect(errorCode({ approvedSemester: 5 })).toBe('SUBJECT_VALIDATION_INCOMPLETE');
  });
});
