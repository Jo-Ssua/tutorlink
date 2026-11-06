import { BadRequestException } from '@nestjs/common';

export interface SubjectEvidenceInput {
  evidenceUrl?: string | null;
  grade?: number | null;
  approvedSemester?: number | null;
}

export interface RegisteredSubjectEvidence {
  evidenceUrl: string | null;
  grade: string | null;
  approvedSemester: number | null;
}

export function assertSubjectCanBeRegistered(
  subject: SubjectEvidenceInput,
  label: string,
): RegisteredSubjectEvidence {
  const evidenceUrl = subject.evidenceUrl?.trim() || null;
  const hasGrade =
    subject.grade !== undefined && subject.grade !== null && !Number.isNaN(subject.grade);
  const hasSemester =
    subject.approvedSemester !== undefined &&
    subject.approvedSemester !== null &&
    !Number.isNaN(subject.approvedSemester);

  if (hasGrade && (subject.grade! < 3 || subject.grade! > 5)) {
    throw new BadRequestException({
      code: 'SUBJECT_NOT_APPROVED',
      message: `${label}: solo puedes registrar materias aprobadas (nota minima 3.0)`,
    });
  }

  if (hasSemester && (subject.approvedSemester! < 1 || subject.approvedSemester! > 20)) {
    throw new BadRequestException({
      code: 'SUBJECT_VALIDATION_INCOMPLETE',
      message: `${label}: el semestre de aprobacion debe estar entre 1 y 20`,
    });
  }

  if (hasGrade !== hasSemester) {
    throw new BadRequestException({
      code: 'SUBJECT_VALIDATION_INCOMPLETE',
      message: `${label}: registra la nota y el semestre en que aprobaste la materia`,
    });
  }

  if (!evidenceUrl && !hasGrade) {
    throw new BadRequestException({
      code: 'SUBJECT_EVIDENCE_REQUIRED',
      message: `${label}: adjunta la evidencia de aprobacion o registra la nota y el semestre para validacion`,
    });
  }

  return {
    evidenceUrl,
    grade: hasGrade ? subject.grade!.toFixed(2) : null,
    approvedSemester: hasSemester ? subject.approvedSemester! : null,
  };
}
