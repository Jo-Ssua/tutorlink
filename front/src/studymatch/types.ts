import type { Modality } from '../types';

export type StudyMatchUrgency = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type StudyMatchRequestStatus =
  | 'SEARCHING'
  | 'PROPOSAL_SENT'
  | 'AWAITING_STUDENT'
  | 'CONFIRMED'
  | 'NO_TUTORS'
  | 'CANCELLED'
  | 'EXPIRED';
export type ProposalStatus =
  | 'PENDING_TUTOR'
  | 'TUTOR_ACCEPTED'
  | 'TUTOR_REJECTED'
  | 'STUDENT_REJECTED'
  | 'CONFIRMED'
  | 'EXPIRED'
  | 'CANCELLED';

export interface StudyMatchPrice {
  hourlyRate: number;
  durationMinutes: number;
  subtotal: number;
  platformFeePercent: number;
  platformFee: number;
  total: number;
  currency: 'COP';
  simulated: true;
}

export interface StudyMatchProposal {
  id: string;
  requestId: string;
  status: ProposalStatus;
  rank: number;
  score: number;
  expiresAt: string;
  respondedAt: string | null;
  createdAt: string;
  tutor: {
    userId: string;
    profileId: string | null;
    fullName: string;
    averageRating: number | null;
    reviewCount: number | null;
    hasReviews: boolean;
    hourlyRate: number | null;
    modalities: Modality[];
  };
  slot: {
    id: string;
    startAt: string;
    endAt: string;
    modality: Modality;
  };
  estimatedPrice: StudyMatchPrice | null;
  awaitingTutor: boolean;
  awaitingStudent: boolean;
}

export interface StudyMatchTutorProposal {
  id: string;
  requestId: string;
  status: ProposalStatus;
  rank: number;
  score: number;
  expiresAt: string;
  respondedAt: string | null;
  createdAt: string;
  studentAlias: string;
  request: {
    id: string;
    subject: { id: string; code: string; name: string };
    professor: { id: string; fullName: string } | null;
    topic: string;
    description: string | null;
    urgency: StudyMatchUrgency;
    modality: Modality;
    availableFrom: string;
    availableTo: string;
  };
  slot: {
    id: string;
    startAt: string;
    endAt: string;
    modality: Modality;
    durationMinutes: number;
  };
}

export interface StudyMatchRequest {
  id: string;
  status: StudyMatchRequestStatus;
  topic: string;
  description: string | null;
  urgency: StudyMatchUrgency;
  modality: Modality;
  availableFrom: string;
  availableTo: string;
  createdAt: string;
  cancelledAt: string | null;
  subject: { id: string; code: string; name: string };
  professor: { id: string; fullName: string } | null;
  proposals: StudyMatchProposal[];
  activeProposal: StudyMatchProposal | null;
  booking: {
    id: string;
    status: string;
    startAt: string;
    endAt: string;
    modality: Modality;
    subject: { id: string; code: string; name: string };
    price: StudyMatchPrice;
    payment: {
      status: string;
      simulated: boolean;
      paidAt: string | null;
    } | null;
  } | null;
  alternatives: unknown[] | null;
}

export interface StudyMatchRequestPage {
  items: StudyMatchRequest[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface StudyMatchActionResult {
  request: StudyMatchRequest;
  proposal: StudyMatchProposal | null;
  next?: StudyMatchActionResult | null;
  booking?: StudyMatchRequest['booking'];
  price?: StudyMatchPrice;
  payment?: {
    id: string;
    reference: string;
    status: string;
    amount: number;
    simulated: boolean;
    paidAt: string;
  };
  expiresAt?: string;
  message: string;
}
