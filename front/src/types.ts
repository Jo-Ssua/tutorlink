export type Role = 'ADMIN' | 'STUDENT' | 'TUTOR';

export type BookingStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'CONFIRMED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'COMPLETED';

export type Modality = 'IN_PERSON' | 'VIRTUAL' | 'HYBRID';

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
  tutor: {
    id: string;
    fullName: string;
    profileId: string | null;
    averageRating: number | null;
    reviewCount: number | null;
  } | null;
  price: {
    hourlyRate: number;
    subtotal: number;
    platformFee: number;
    total: number;
    currency: string;
    simulated: boolean;
  };
  review: BookingReview | null;
  payment: {
    id: string;
    reference: string;
    status: string;
    amount: number;
    simulated: boolean;
    paidAt: string | null;
  } | null;
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
  };
  meta: {
    timestamp: string;
    path: string;
    requestId: string;
    statusCode: number;
  };
}
