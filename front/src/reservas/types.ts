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

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiErrorBody {
  success: false;
  error: {
    code?: string;
    message?: string;
    details?: string[];
    fields?: Record<string, string[]>;
  };
}

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
  subjects: SubjectRef[];
  nextAvailableAt: string | null;
  isAvailable: boolean;
}

export interface TutorList {
  items: TutorCard[];
  pagination: Pagination;
}

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
  program: { name: string; facultyId: string };
}

export interface ProfessorOption {
  id: string;
  fullName: string;
  programId: string;
  program: { facultyId: string };
}

export interface TutorSubjectDetail extends SubjectRef {
  program: string;
  faculty: string;
  status: VerificationStatus;
}

export interface TutorReview {
  rating: number;
  comment: string;
  createdAt: string;
  subject: string;
}

export interface AvailabilitySlot {
  id: string;
  startAt: string;
  endAt: string;
  modality: Modality;
  status: 'AVAILABLE' | 'HELD' | 'RESERVED' | 'BLOCKED';
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
