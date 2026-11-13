import type { AvailabilitySlot } from './reservas/types';

export type Role = 'ADMIN' | 'STUDENT' | 'TUTOR';

export type BookingStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'CONFIRMED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'COMPLETED';

export type Modality = 'IN_PERSON' | 'VIRTUAL' | 'HYBRID';

export type VerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

export interface TutorOwnProfile {
  id: string;
  fullName: string;
  email: string;
  bio: string | null;
  experienceYears: number;
  hourlyRate: number;
  verificationStatus: VerificationStatus;
  rejectionReason: string | null;
  modalities: Modality[];
  isActive: boolean;
  maxWeeklySessions: number | null;
  subjects: Array<{
    id: string;
    status: VerificationStatus;
    evidenceUrl: string | null;
    rejectionReason: string | null;
    subject: { id: string; code: string; name: string };
  }>;
  nextAvailability: AvailabilitySlot[];
}

export interface CatalogSubject {
  id: string;
  code: string;
  name: string;
  programId: string;
  program: { name: string };
}

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  status: string;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: string;
  refreshExpiresIn: string;
  user: SessionUser;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Desglose del costo tal como quedó registrado en la reserva. El porcentaje de
 * comisión viene del backend: se deriva de los montos guardados, así que una
 * reserva vieja sigue mostrando el porcentaje con el que se cotizó.
 */
export interface BookingPrice {
  hourlyRate: number;
  durationMinutes: number;
  subtotal: number;
  platformFeePercent: number;
  platformFee: number;
  total: number;
  currency: string;
  simulated: boolean;
}

export interface BookingPayment {
  id: string;
  reference: string;
  status: string;
  amount: number;
  simulated: boolean;
  paidAt: string | null;
}

export interface SimulatedPaymentResult {
  booking: Booking;
  payment: BookingPayment;
  disclaimer: string;
}

export interface BookingReview {
  rating: number;
  comment: string | null;
  createdAt: string;
  isAnonymous: boolean;
}

export interface Booking {
  id: string;
  status: BookingStatus;
  topic: string;
  description: string | null;
  modality: Modality;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  isEmergency: boolean;
  requestId: string | null;
  proposalId: string | null;
  subject: { id: string; name: string; code: string };
  /** En la vista del tutor el estudiante llega anonimizado. */
  student?: { id?: string; alias?: string; fullName?: string | null } | null;
  tutor: {
    id: string;
    fullName: string;
    profileId: string | null;
    averageRating: number | null;
    reviewCount: number | null;
  } | null;
  price: BookingPrice;
  review: BookingReview | null;
  payment: BookingPayment | null;
  cancellationReason: string | null;
  cancelledAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface BookingList {
  items: Booking[];
  pagination: PaginationMeta;
}

export interface CreateReviewPayload {
  rating: number;
  comment?: string;
  isAnonymous?: boolean;
}

export interface CreateReviewResult {
  review: {
    id: string;
    bookingId: string;
    rating: number;
    comment: string | null;
    isAnonymous: boolean;
    createdAt: string;
  };
  tutorRating: {
    averageRating: number;
    reviewCount: number;
  };
  message: string;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta: {
    timestamp: string;
    path: string;
    requestId: string;
    statusCode: number;
  };
}

export interface ApiErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
    details?: string[];
    fields?: Record<string, string[]>;
  };
  meta: {
    timestamp: string;
    path: string;
    requestId: string;
    statusCode: number;
  };
}

export interface AdminStats {
  users: { students: number; tutors: number; admins: number };
  applications: { pendingTutorApplications: number; pendingSubjects: number };
  bookings: { pending: number; confirmed: number; completed: number; cancelled: number };
  simulatedRevenue: {
    gross: number;
    platformFees: number;
    tutorEarnings: number;
    currency: string;
  };
}

export interface TutorApplication {
  id: string;
  userId: string;
  fullName: string;
  institutionalEmail: string;
  userStatus: string;
  verificationStatus: string;
  hourlyRate: number;
  experienceYears: number;
  createdAt: string;
  subjects: Array<{
    id: string;
    status: string;
    subject: { id: string; name: string; code: string };
  }>;
}

export interface TutorApplicationList {
  items: TutorApplication[];
  pagination: PaginationMeta;
}

export interface Program {
  id: string;
  name: string;
  code: string;
  faculty: { id: string; name: string; code: string };
}

export interface OwnTutorApplicationSubject {
  id: string;
  status: VerificationStatus;
  evidenceUrl: string | null;
  grade: number | null;
  approvedSemester: number | null;
  rejectionReason: string | null;
  subject: { id: string; code: string; name: string };
}

/** Postulación del estudiante autenticado, distinta del listado de administración. */
export interface OwnTutorApplication {
  verificationStatus: VerificationStatus;
  rejectionReason: string | null;
  bio: string | null;
  experienceYears: number;
  hourlyRate: number;
  modalities: Modality[];
  subjects: OwnTutorApplicationSubject[];
}

export interface AcademicProfileSnapshot {
  studentCode: string | null;
  semester: number | null;
  program: Program | null;
}

export interface OwnTutorApplicationSnapshot {
  academicProfile: AcademicProfileSnapshot | null;
  application: OwnTutorApplication | null;
}

export interface ApplyTutorSubjectPayload {
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
  subjects: ApplyTutorSubjectPayload[];
}

export interface RegisterPayload {
  fullName: string;
  email: string;
  password: string;
  studentCode?: string;
  programId?: string;
  semester?: number;
}

/**
 * Respuesta de /auth/register y /auth/resend-verification. Es la misma exista o
 * no una cuenta con ese correo: la API no revela si el correo esta registrado.
 */
export interface VerificationPending {
  email: string;
  verificationRequired: true;
  verificationExpiresAt: string;
  /** Solo en desarrollo, con EXPOSE_DEV_CODES=true. */
  devVerificationCode?: string;
  message: string;
}

export interface VerifyEmailResult {
  verified: true;
  user: { id: string; email: string; role: Role; status: string };
}
