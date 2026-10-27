import { Modality } from '@prisma/client';

export function isModalityCompatible(
  requested: Modality,
  offered: Modality,
): boolean {
  if (requested === Modality.HYBRID) {
    return true;
  }

  if (requested === Modality.IN_PERSON) {
    return offered === Modality.IN_PERSON || offered === Modality.HYBRID;
  }

  return offered === Modality.VIRTUAL || offered === Modality.HYBRID;
}

export function compatibleModalities(requested: Modality): Modality[] {
  if (requested === Modality.HYBRID) {
    return [Modality.HYBRID, Modality.IN_PERSON, Modality.VIRTUAL];
  }

  if (requested === Modality.IN_PERSON) {
    return [Modality.IN_PERSON, Modality.HYBRID];
  }

  return [Modality.VIRTUAL, Modality.HYBRID];
}

export function slotsOverlap(
  first: { startAt: Date; endAt: Date },
  second: { startAt: Date; endAt: Date },
): boolean {
  return first.startAt < second.endAt && first.endAt > second.startAt;
}
