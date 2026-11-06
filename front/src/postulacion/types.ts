export type Modality = 'IN_PERSON' | 'VIRTUAL' | 'HYBRID';
export type VerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';
export type EvidenceMode = 'evidence' | 'record';

export interface CatalogFaculty {
  id: string;
  name: string;
  code: string;
}

export interface CatalogProgram {
  id: string;
  name: string;
  code: string;
  facultyId: string;
  faculty: CatalogFaculty;
}

export interface CatalogSubject {
  id: string;
  name: string;
  code: string;
  credits: number;
  programId: string;
  program: {
    id: string;
    name: string;
    code: string;
    faculty?: CatalogFaculty;
  };
}

export interface AcademicProfile {
  studentCode: string | null;
  semester: number | null;
  program: (CatalogProgram & { faculty?: CatalogFaculty }) | null;
}

export interface ApplicationSubject {
  id: string;
  status: VerificationStatus;
  evidenceUrl: string | null;
  grade: number | null;
  approvedSemester: number | null;
  rejectionReason: string | null;
  subject: { id: string; code: string; name: string };
}

export interface TutorApplication {
  id: string;
  verificationStatus: VerificationStatus;
  rejectionReason: string | null;
  bio: string | null;
  experienceYears: number;
  hourlyRate: number;
  modalities: Modality[];
  subjects: ApplicationSubject[];
  academicProfile?: AcademicProfile;
}

export interface ApplicationSnapshot {
  academicProfile: AcademicProfile | null;
  application: TutorApplication | null;
}

export interface ApplySubjectPayload {
  subjectId: string;
  evidenceUrl?: string;
  grade?: number;
  approvedSemester?: number;
}

export interface ApplyTutorPayload {
  programId: string;
  semester: number;
  studentCode: string;
  bio?: string;
  experienceYears: number;
  hourlyRate: number;
  modalities: Modality[];
  subjects: ApplySubjectPayload[];
}

export interface DraftSubject {
  subjectId: string;
  code: string;
  name: string;
  mode: EvidenceMode;
  evidenceUrl: string;
  grade: string;
  approvedSemester: string;
}
