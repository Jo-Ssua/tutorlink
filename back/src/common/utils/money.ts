export interface PriceBreakdown {
  hourlyRate: number;
  durationMinutes: number;
  subtotal: number;
  platformFeePercent: number;
  platformFee: number;
  total: number;
  tutorEarnings: number;
  currency: 'COP';
  simulated: true;
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculatePrice(
  hourlyRate: number,
  durationMinutes: number,
  platformFeePercent: number,
): PriceBreakdown {
  const subtotal = roundMoney((hourlyRate * durationMinutes) / 60);
  const platformFee = roundMoney((subtotal * platformFeePercent) / 100);
  const total = roundMoney(subtotal + platformFee);

  return {
    hourlyRate: roundMoney(hourlyRate),
    durationMinutes,
    subtotal,
    platformFeePercent,
    platformFee,
    total,
    tutorEarnings: subtotal,
    currency: 'COP',
    simulated: true,
  };
}

export function money(value: { toNumber(): number } | number | string): number {
  if (typeof value === 'number') {
    return roundMoney(value);
  }

  if (typeof value === 'string') {
    return roundMoney(Number.parseFloat(value));
  }

  return roundMoney(value.toNumber());
}

export function moneyString(value: number): string {
  return roundMoney(value).toFixed(2);
}
