import { Injectable } from '@nestjs/common';
import { Modality, Urgency } from '@prisma/client';
import { roundMoney } from '../common/utils/money';

export interface ScoringWeights {
  professorMatch: number;
  rating: number;
  availability: number;
  workload: number;
}

export interface CandidateSlot {
  id: string;
  startAt: Date;
  endAt: Date;
  modality: Modality;
}

export interface ScoringCandidate {
  tutorProfileId: string;
  userId: string;
  averageRating: number;
  reviewCount: number;
  professorIds: string[];
  slots: CandidateSlot[];
  activeBookingsCount: number;
}

export interface ScoringRequest {
  professorId?: string | null;
  urgency: Urgency;
  modality: Modality;
  availableFrom: Date;
  availableTo: Date;
  now?: Date;
}

export interface ScoreBreakdown {
  professorMatch: {
    score: number;
    max: number;
    matched: boolean;
  };
  rating: {
    score: number;
    max: number;
    averageRating: number;
    reviewCount: number;
    hasReviews: boolean;
  };
  availability: {
    score: number;
    max: number;
    slotId: string;
    startAt: Date;
    minutesUntil: number;
    urgencyTargetHours: number;
  };
  workload: {
    score: number;
    max: number;
    activeBookings: number;
  };
}

export interface ScoreResult {
  total: number;
  breakdown: ScoreBreakdown;
  bestSlot: CandidateSlot;
}

@Injectable()
export class ScoringService {
  score(
    candidate: ScoringCandidate,
    request: ScoringRequest,
    weights: ScoringWeights,
  ): ScoreResult | null {
    const now = request.now ?? new Date();
    const bestSlot = [...candidate.slots]
      .filter(
        (slot) =>
          slot.startAt >= request.availableFrom &&
          slot.endAt <= request.availableTo &&
          slot.endAt > now,
      )
      .sort((first, second) => first.startAt.getTime() - second.startAt.getTime())[0];

    if (!bestSlot) {
      return null;
    }

    const professorMatched = Boolean(
      request.professorId && candidate.professorIds.includes(request.professorId),
    );
    const professorScore = professorMatched ? weights.professorMatch : 0;

    const hasReviews = candidate.reviewCount > 0;
    const ratingScore = hasReviews
      ? weights.rating * Math.min(candidate.averageRating, 5) / 5
      : 0;

    const minutesUntil = Math.max(0, (bestSlot.startAt.getTime() - now.getTime()) / 60_000);
    const targetHours = this.urgencyTargetHours(request.urgency);
    const availabilityFactor = Math.max(
      0.1,
      Math.min(1, 1 - minutesUntil / 60 / (targetHours * 3)),
    );
    const availabilityScore = weights.availability * availabilityFactor;

    const workloadScore =
      weights.workload * (1 - Math.min(candidate.activeBookingsCount, 5) / 5);

    const breakdown: ScoreBreakdown = {
      professorMatch: {
        score: roundMoney(professorScore),
        max: weights.professorMatch,
        matched: professorMatched,
      },
      rating: {
        score: roundMoney(ratingScore),
        max: weights.rating,
        averageRating: roundMoney(candidate.averageRating),
        reviewCount: candidate.reviewCount,
        hasReviews,
      },
      availability: {
        score: roundMoney(availabilityScore),
        max: weights.availability,
        slotId: bestSlot.id,
        startAt: bestSlot.startAt,
        minutesUntil: roundMoney(minutesUntil),
        urgencyTargetHours: targetHours,
      },
      workload: {
        score: roundMoney(workloadScore),
        max: weights.workload,
        activeBookings: candidate.activeBookingsCount,
      },
    };

    const total = roundMoney(
      professorScore + ratingScore + availabilityScore + workloadScore,
    );

    return { total, breakdown, bestSlot };
  }

  urgencyTargetHours(urgency: Urgency): number {
    const targets: Record<Urgency, number> = {
      [Urgency.CRITICAL]: 1,
      [Urgency.HIGH]: 3,
      [Urgency.MEDIUM]: 12,
      [Urgency.LOW]: 48,
    };

    return targets[urgency];
  }
}
