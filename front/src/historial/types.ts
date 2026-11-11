import type { BookingStatus, Modality, PaginationMeta } from '../types';

/**
 * Tipos del historial del tutor (`/tutor/history`). Viven aparte de `types.ts`
 * para que esta funcionalidad no toque los archivos compartidos.
 */

export interface HistoryReview {
  rating: number;
  comment: string | null;
  isAnonymous: boolean;
  createdAt: string;
}

export interface HistorySubject {
  id: string;
  code: string;
  name: string;
}

export interface HistoryItem {
  id: string;
  /** Alias anonimo del estudiante: la API nunca entrega su identidad. */
  studentAlias: string;
  subject: HistorySubject;
  topic: string;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  modality: Modality;
  status: BookingStatus;
  /** Tarifa por hora pactada en la sesion. */
  rate: number;
  /** Valor de la sesion para el tutor, sin la comision de la plataforma. */
  subtotal: number;
  total: number;
  isEmergency: boolean;
  review: HistoryReview | null;
}

export interface HistoryDetail extends HistoryItem {
  description: string | null;
  platformFee: number;
  tutorEarnings: number;
  cancellationReason: string | null;
  cancelledAt: string | null;
  completedAt: string | null;
  createdAt: string;
  payment: {
    status: string;
    reference: string;
    paidAt: string | null;
    simulated: boolean;
  } | null;
}

export interface HistoryList {
  items: HistoryItem[];
  pagination: PaginationMeta;
}

export interface HistorySummary {
  totalSessions: number;
  sessionsByStatus: Record<BookingStatus, number>;
  completedSessions: number;
  reviewCount: number;
  averageRating: number;
  ratingDistribution: Record<'1' | '2' | '3' | '4' | '5', number>;
  firstSessionAt: string | null;
  subjects: HistorySubject[];
}

export interface HistoryFilters {
  /** `AAAA-MM-DD`, tal como lo entrega un `<input type="date">`. */
  from: string;
  to: string;
  subjectId: string;
  status: BookingStatus | '';
}
