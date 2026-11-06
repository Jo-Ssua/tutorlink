import { request } from '../api';
import type {
  AvailabilitySlot,
  CreateBookingPayload,
  CreatedBooking,
  FacultyOption,
  ProfessorOption,
  ProgramOption,
  QuoteResult,
  SubjectOption,
  TutorSearchFilters,
  TutorList,
  TutorProfile,
} from './types';

/**
 * Endpoints del flujo de reserva. El transporte (token, renovación en 401 y
 * aviso de sesión caída) es el `request()` compartido de `../api`: esta sección
 * tenía antes su propio cliente, que no renovaba el token ni limpiaba la sesión.
 *
 * Los errores llegan como `ApiError`, con `fields` para la validación por campo.
 */
export function listTutors(filters: TutorSearchFilters = {}): Promise<TutorList> {
  const query = new URLSearchParams({
    limit: '50',
    sortBy: filters.sortBy ?? 'RELEVANCE',
  });
  if (filters.q?.trim()) query.set('q', filters.q.trim());
  if (filters.minRating !== undefined) query.set('minRating', String(filters.minRating));
  if (filters.maxRate !== undefined) query.set('maxRate', String(filters.maxRate));
  if (filters.modality) query.set('modality', filters.modality);
  if (filters.facultyId) query.set('facultyId', filters.facultyId);
  if (filters.programId) query.set('programId', filters.programId);
  if (filters.subjectId) query.set('subjectId', filters.subjectId);
  if (filters.professorId) query.set('professorId', filters.professorId);
  return request<TutorList>(`/tutors?${query.toString()}`);
}

/*
 * Catálogo oficial para la búsqueda contextual. Cada consulta hereda lo ya
 * elegido, así que la lista que llega solo trae opciones compatibles: un
 * programa de la facultad escogida, una materia de ese programa, un profesor
 * que dicte esa materia. Filtrar en el servidor evita traerse todo el pensum.
 */
export function listFaculties(): Promise<FacultyOption[]> {
  return request<FacultyOption[]>('/catalog/faculties');
}

export function listPrograms(facultyId?: string): Promise<ProgramOption[]> {
  const query = new URLSearchParams();
  if (facultyId) query.set('facultyId', facultyId);
  return request<ProgramOption[]>(`/catalog/programs?${query.toString()}`);
}

export function listSubjects(scope: {
  facultyId?: string;
  programId?: string;
}): Promise<SubjectOption[]> {
  const query = new URLSearchParams();
  if (scope.facultyId) query.set('facultyId', scope.facultyId);
  if (scope.programId) query.set('programId', scope.programId);
  return request<SubjectOption[]>(`/catalog/subjects?${query.toString()}`);
}

export function listProfessors(scope: {
  facultyId?: string;
  programId?: string;
  subjectId?: string;
}): Promise<ProfessorOption[]> {
  const query = new URLSearchParams();
  if (scope.facultyId) query.set('facultyId', scope.facultyId);
  if (scope.programId) query.set('programId', scope.programId);
  if (scope.subjectId) query.set('subjectId', scope.subjectId);
  return request<ProfessorOption[]>(`/catalog/professors?${query.toString()}`);
}

export function getTutor(tutorProfileId: string): Promise<TutorProfile> {
  return request<TutorProfile>(`/tutors/${tutorProfileId}`);
}

export function getAvailability(tutorProfileId: string): Promise<AvailabilitySlot[]> {
  return request<AvailabilitySlot[]>(`/tutors/${tutorProfileId}/availability`);
}

export function quoteBooking(tutorProfileId: string, slotId: string): Promise<QuoteResult> {
  return request<QuoteResult>('/bookings/quote', {
    method: 'POST',
    body: JSON.stringify({ tutorProfileId, slotId }),
  });
}

export function createBooking(payload: CreateBookingPayload): Promise<CreatedBooking> {
  return request<CreatedBooking>('/bookings', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
