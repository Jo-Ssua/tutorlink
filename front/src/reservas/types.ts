export type Modality = 'IN_PERSON' | 'VIRTUAL' | 'HYBRID';
export type VerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';
export type ChosenModality = 'IN_PERSON' | 'VIRTUAL';
export type BookingStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'CONFIRMED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'COMPLETED';

export type TutorSortBy = 'RELEVANCE' | 'RATING' | 'PRICE' | 'AVAILABILITY';

export interface TutorSearchFilters {
  q?: string;
  minRating?: number;
  maxRate?: number;
  modality?: Modality;
  facultyId?: string;
  programId?: string;
  subjectId?: string;
  professorId?: string;
  sortBy?: TutorSortBy;
}

/*
 * Opciones del catálogo oficial para la búsqueda contextual. Son los mismos
 * registros de `/catalog/*`, recortados a lo que necesita cada selector: el
 * identificador del padre deja encadenar facultad -> programa -> materia ->
 * profesor sin volver a consultar el pensum completo.
 */
export interface FacultyOption {
  id: string;
  name: string;
  code: string;
}

export interface ProgramOption {
  id: string;
  name: string;
  code: string;
  facultyId: string;
}

export interface SubjectOption {
  id: string;
  name: string;
  code: string;
  programId: string;
}

export interface ProfessorOption {
  id: string;
  fullName: string;
  programId: string;
}

/*
 * `ApiSuccess` y `ApiErrorBody` vivían aquí duplicados; ahora están en
 * `src/types.ts` porque el transporte es el `request()` compartido.
 */

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface SubjectRef {
  id: string;
  code: string;
  name: string;
}

export interface TutorCard {
  id: string;
  fullName: string;
  bio: string | null;
  hourlyRate: number;
  modalities: Modality[];
  averageRating: number;
  reviewCount: number;
  verificationStatus: VerificationStatus;
  subjects: SubjectRef[];
  nextAvailableAt: string | null;
  isAvailable: boolean;
}

export interface TutorList {
  items: TutorCard[];
  pagination: Pagination;
  /** Qué hacer cuando no hay resultados; la API la manda solo si `total` es 0. */
  suggestions: string | null;
}

export interface TutorSubjectDetail extends SubjectRef {
  program: string;
  faculty: string;
  status: VerificationStatus;
}

export interface TutorReview {
  rating: number;
  /** La reseña puede ser solo estrellas: el comentario es opcional. */
  comment: string | null;
  createdAt: string;
  subject: string;
}

export interface AvailabilitySlot {
  id: string;
  startAt: string;
  endAt: string;
  modality: Modality;
  status: 'AVAILABLE' | 'HELD' | 'RESERVED' | 'BLOCKED';
  durationMinutes?: number;
}

export interface TutorProfile {
  id: string;
  fullName: string;
  bio: string | null;
  experienceYears: number;
  hourlyRate: number;
  modalities: Modality[];
  averageRating: number;
  reviewCount: number;
  hasReviews: boolean;
  verificationStatus: VerificationStatus;
  completedSessions: number;
  subjects: TutorSubjectDetail[];
  recentReviews: TutorReview[];
  nextAvailability: AvailabilitySlot[];
}

export interface PriceBreakdown {
  hourlyRate: number;
  durationMinutes: number;
  subtotal: number;
  platformFeePercent: number;
  platformFee: number;
  total: number;
  currency: 'COP';
  simulated: true;
}

export interface QuoteResult {
  price: PriceBreakdown;
  disclaimer: string;
}

export interface CreateBookingPayload {
  tutorProfileId: string;
  slotId: string;
  subjectId: string;
  topic: string;
  modality: ChosenModality;
  description?: string;
}

export interface CreatedBooking {
  booking: {
    id: string;
    status: BookingStatus;
    topic: string;
    description: string | null;
    modality: Modality;
    startAt: string;
    endAt: string;
    durationMinutes: number;
    subject: SubjectRef;
    tutor: { fullName: string } | null;
    price: PriceBreakdown;
  };
  message: string;
}
