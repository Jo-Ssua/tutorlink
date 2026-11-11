export type NotificationType =
  | 'TUTOR_APPLICATION_SUBMITTED'
  | 'TUTOR_APPLICATION_APPROVED'
  | 'TUTOR_APPLICATION_REJECTED'
  | 'TUTOR_SUBJECT_VERIFIED'
  | 'TUTOR_SUBJECT_REJECTED'
  | 'TUTORING_REQUEST_CREATED'
  | 'BOOKING_CREATED'
  | 'BOOKING_STATUS_CHANGED'
  | 'STUDYMATCH_PROPOSAL'
  | 'STUDYMATCH_PROPOSAL_ACCEPTED'
  | 'STUDYMATCH_PROPOSAL_REJECTED'
  | 'STUDYMATCH_PROPOSAL_EXPIRED'
  | 'STUDYMATCH_NO_TUTORS'
  | 'STUDYMATCH_REQUEST_CONFIRMED'
  | 'REVIEW_RECEIVED'
  | 'PAYMENT_SIMULATED'
  | 'SYSTEM';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  data: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationList {
  items: Notification[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}
