/**
 * Interest-rate context for money coach.
 * User-entered card/loan APRs win; reference savings rate is a configurable heuristic.
 */

export const DEFAULT_REFERENCE_SAVINGS_APR = 4.25;

/** Env override for HYSA / cash-yield reference (percent). */
export function referenceSavingsAprPercent(
  override?: number,
): number {
  if (typeof override === 'number' && Number.isFinite(override) && override >= 0) {
    return override;
  }
  const fromEnv = Number.parseFloat(
    process.env.EXPO_PUBLIC_FINANCE_REFERENCE_SAVINGS_APR ?? '',
  );
  if (Number.isFinite(fromEnv) && fromEnv >= 0) return fromEnv;
  return DEFAULT_REFERENCE_SAVINGS_APR;
}

export function aprBeatsCash(aprPercent: number, savingsApr: number): boolean {
  return aprPercent >= savingsApr + 3;
}

export function describeAprVsCash(
  aprPercent: number,
  savingsApr: number,
): string {
  if (aprBeatsCash(aprPercent, savingsApr)) {
    return `At ${aprPercent.toFixed(1)}% vs ~${savingsApr.toFixed(1)}% cash yield, paying this debt first usually beats parking more in savings.`;
  }
  if (aprPercent <= savingsApr) {
    return `This rate (~${aprPercent.toFixed(1)}%) is at or below typical cash yield (~${savingsApr.toFixed(1)}%) — extra principal is less urgent than filling emergency cash or high-interest debts.`;
  }
  return `This rate (~${aprPercent.toFixed(1)}%) is only a bit above cash (~${savingsApr.toFixed(1)}%). Split focus: keep a cash buffer, then chip at principal.`;
}
