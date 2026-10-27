import { Modality, Urgency } from '@prisma/client';
import { ScoringCandidate, ScoringRequest, ScoringService, ScoringWeights } from './scoring.service';

describe('ScoringService', () => {
  const service = new ScoringService();
  const now = new Date('2026-10-27T12:00:00.000Z');
  const weights: ScoringWeights = {
    professorMatch: 35,
    rating: 30,
    availability: 25,
    workload: 10,
  };

  const request: ScoringRequest = {
    professorId: 'professor-1',
    urgency: Urgency.CRITICAL,
    modality: Modality.VIRTUAL,
    availableFrom: now,
    availableTo: new Date('2026-11-03T12:00:00.000Z'),
    now,
  };

  function candidate(overrides: Partial<ScoringCandidate> = {}): ScoringCandidate {
    return {
      tutorProfileId: 'tutor-profile-1',
      userId: 'tutor-user-1',
      averageRating: 5,
      reviewCount: 1,
      professorIds: ['professor-1'],
      slots: [
        {
          id: 'slot-1',
          startAt: now,
          endAt: new Date('2026-10-27T13:00:00.000Z'),
          modality: Modality.VIRTUAL,
        },
      ],
      activeBookingsCount: 0,
      ...overrides,
    };
  }

  it('suma los cuatro componentes cuando hay coincidencia y disponibilidad inmediata', () => {
    const result = service.score(candidate(), request, weights);

    expect(result).not.toBeNull();
    expect(result?.total).toBe(100);
    expect(result?.breakdown.professorMatch).toEqual({
      score: 35,
      max: 35,
      matched: true,
    });
    expect(result?.breakdown.rating.score).toBe(30);
    expect(result?.breakdown.availability.score).toBe(25);
    expect(result?.breakdown.workload.score).toBe(10);
    expect(result?.bestSlot.id).toBe('slot-1');
  });

  it('no asigna puntaje de profesor si la solicitud no indica profesor', () => {
    const result = service.score(candidate(), { ...request, professorId: null }, weights);

    expect(result?.total).toBe(65);
    expect(result?.breakdown.professorMatch.matched).toBe(false);
    expect(result?.breakdown.professorMatch.score).toBe(0);
  });

  it('no asigna puntaje de rating cuando el tutor no tiene resenas', () => {
    const result = service.score(
      candidate({ averageRating: 0, reviewCount: 0 }),
      request,
      weights,
    );

    expect(result?.total).toBe(70);
    expect(result?.breakdown.rating.score).toBe(0);
    expect(result?.breakdown.rating.hasReviews).toBe(false);
  });

  it('reduce el puntaje de carga a medida que aumentan las reservas activas', () => {
    const withoutLoad = service.score(candidate({ activeBookingsCount: 0 }), request, weights);
    const fullLoad = service.score(candidate({ activeBookingsCount: 5 }), request, weights);

    expect(withoutLoad?.breakdown.workload.score).toBe(10);
    expect(fullLoad?.breakdown.workload.score).toBe(0);
    expect(fullLoad?.total).toBe(90);
  });

  it('elige la franja mas cercana entre las elegibles', () => {
    const result = service.score(
      candidate({
        slots: [
          {
            id: 'slot-later',
            startAt: new Date('2026-10-27T17:00:00.000Z'),
            endAt: new Date('2026-10-27T18:00:00.000Z'),
            modality: Modality.VIRTUAL,
          },
          {
            id: 'slot-sooner',
            startAt: new Date('2026-10-27T13:00:00.000Z'),
            endAt: new Date('2026-10-27T14:00:00.000Z'),
            modality: Modality.VIRTUAL,
          },
        ],
      }),
      request,
      weights,
    );

    expect(result?.bestSlot.id).toBe('slot-sooner');
  });

  it('retorna null si ninguna franja cae dentro de la ventana solicitada', () => {
    const result = service.score(
      candidate({
        slots: [
          {
            id: 'slot-outside',
            startAt: new Date('2026-11-10T12:00:00.000Z'),
            endAt: new Date('2026-11-10T13:00:00.000Z'),
            modality: Modality.VIRTUAL,
          },
        ],
      }),
      request,
      weights,
    );

    expect(result).toBeNull();
  });

  it('penaliza una franja lejana frente a una inmediata en solicitudes criticas', () => {
    const immediate = service.score(candidate(), request, weights);
    const far = service.score(
      candidate({
        slots: [
          {
            id: 'slot-far',
            startAt: new Date('2026-10-27T22:00:00.000Z'),
            endAt: new Date('2026-10-27T23:00:00.000Z'),
            modality: Modality.VIRTUAL,
          },
        ],
      }),
      request,
      weights,
    );

    expect(immediate?.breakdown.availability.score).toBeGreaterThan(
      far?.breakdown.availability.score ?? 0,
    );
  });

  it('mapea los objetivos de urgencia a horas', () => {
    expect(service.urgencyTargetHours(Urgency.CRITICAL)).toBe(1);
    expect(service.urgencyTargetHours(Urgency.HIGH)).toBe(3);
    expect(service.urgencyTargetHours(Urgency.MEDIUM)).toBe(12);
    expect(service.urgencyTargetHours(Urgency.LOW)).toBe(48);
  });
});
