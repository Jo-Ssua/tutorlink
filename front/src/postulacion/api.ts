import { ApiError, request } from '../api';
import type {
  ApplicationSnapshot,
  ApplyTutorPayload,
  CatalogProgram,
  CatalogSubject,
  TutorApplication,
} from './types';

export async function getPrograms(): Promise<CatalogProgram[]> {
  return request<CatalogProgram[]>('/catalog/programs');
}

export async function getOfficialSubjects(): Promise<CatalogSubject[]> {
  return request<CatalogSubject[]>('/catalog/subjects');
}

export async function getTutorApplication(): Promise<ApplicationSnapshot> {
  return request<ApplicationSnapshot>('/tutor/application');
}

export async function submitTutorApplication(
  payload: ApplyTutorPayload,
): Promise<TutorApplication> {
  return request<TutorApplication>('/tutor/apply', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function isSessionExpired(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'SESSION_EXPIRED';
}

export function applicationError(error: unknown): { message: string; details: string[] } {
  if (error instanceof ApiError) {
    return { message: error.message, details: error.details };
  }

  if (error instanceof Error) {
    return { message: error.message, details: [] };
  }

  return { message: 'No fue posible completar la postulación.', details: [] };
}
