import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { Theme } from '@/design-system';

import { lookupFlightData } from './flight-status-client';
import {
    flightOperationalStatusLabel,
    type FlightOperationalStatus,
    type FlightStatusInput,
} from './flights/types';

export type FlightStatusRequest = {
  input: FlightStatusInput;
  /** Flight number shown beside the status when a journey has several legs. */
  label?: string;
};

export type FlightLegStatus = {
  label?: string;
  status?: FlightOperationalStatus;
  /** Provider-authored status copy, e.g. `On Time` / `Delayed`. */
  statusLabel?: string;
  departureTerminal?: string;
  departureGate?: string;
  arrivalTerminal?: string;
  arrivalGate?: string;
};

export type FlightStatusLookup = {
  /** At least one leg has enough data (flight number + date) to look up. */
  available: boolean;
  loading: boolean;
  checked: boolean;
  /** False while a prior sync for this journey is still cooling down. */
  canCheck: boolean;
  /** Whole minutes left before the next sync is allowed (0 when ready). */
  cooldownMinutesRemaining: number;
  /** Results aligned with the requests passed in, so legs keep their slot. */
  legs: (FlightLegStatus | undefined)[];
  /** Card-level summary, e.g. `UA 1907: Boarding · UA 1697: Scheduled`. */
  summary?: string;
  /** Most urgent status across legs, for badge tone. */
  status?: FlightOperationalStatus;
  error?: string;
  check: () => void;
};

/** Users may refresh live status at most once per journey in this window. */
export const FLIGHT_STATUS_SYNC_COOLDOWN_MS = 10 * 60 * 1000;

/** Highest number wins when a journey mixes leg statuses. */
const STATUS_URGENCY: Record<FlightOperationalStatus, number> = {
  unknown: 0,
  scheduled: 1,
  'check-in': 2,
  landed: 3,
  approaching: 4,
  departed: 5,
  boarding: 6,
  'gate-closed': 7,
  delayed: 8,
  diverted: 9,
  cancelled: 10,
};

/** Survives card remounts so collapsing/expanding cannot bypass the cooldown. */
const lastSyncAtByKey = new Map<string, number>();
/** Last successful/attempted leg results for the same journey fingerprint. */
const lastLegsByKey = new Map<string, (FlightLegStatus | undefined)[]>();

export type FlightStatusTone = 'neutral' | 'positive' | 'caution' | 'critical';

export function flightStatusTone(
  status?: FlightOperationalStatus,
): FlightStatusTone {
  if (!status || status === 'unknown') return 'neutral';
  if (status === 'cancelled' || status === 'diverted') return 'critical';
  if (status === 'delayed' || status === 'gate-closed') return 'caution';
  return 'positive';
}

export function flightStatusToneColor(
  tone: FlightStatusTone,
  theme: Theme,
): string {
  return {
    neutral: theme.textSecondary,
    positive: theme.success,
    caution: theme.warning,
    critical: theme.danger,
  }[tone];
}

export function flightStatusSyncRequestKey(
  requests: (FlightStatusRequest | undefined)[],
): string {
  return requests
    .map((request) =>
      request
        ? [
            request.input.flightNumber.replace(/\s/g, '').toUpperCase(),
            request.input.date,
            request.input.departureAirport ?? '',
            request.input.arrivalAirport ?? '',
          ].join('|')
        : '',
    )
    .join(';');
}

export function flightStatusSyncCooldownRemainingMs(
  key: string,
  now = Date.now(),
): number {
  if (!key) return 0;
  const last = lastSyncAtByKey.get(key);
  if (last === undefined) return 0;
  return Math.max(0, last + FLIGHT_STATUS_SYNC_COOLDOWN_MS - now);
}

export function flightStatusSyncCooldownMinutesRemaining(
  remainingMs: number,
): number {
  if (remainingMs <= 0) return 0;
  return Math.max(1, Math.ceil(remainingMs / 60_000));
}

/** @internal — Jest only. */
export function __resetFlightStatusSyncCooldownsForTests(): void {
  lastSyncAtByKey.clear();
  lastLegsByKey.clear();
}

/** @internal — Jest only. */
export function __setFlightStatusSyncAtForTests(key: string, at: number): void {
  lastSyncAtByKey.set(key, at);
}

function mostUrgent(
  legs: (FlightLegStatus | undefined)[],
): FlightOperationalStatus | undefined {
  return legs.reduce<FlightOperationalStatus | undefined>((worst, leg) => {
    if (!leg?.status) return worst;
    if (!worst) return leg.status;
    return STATUS_URGENCY[leg.status] > STATUS_URGENCY[worst]
      ? leg.status
      : worst;
  }, undefined);
}

/**
 * Shared per-leg flight-status lookup. The journey card owns this state so the
 * booking panel badge / sync control, per-leg itinerary chips, and terminal/gate
 * chips all read the same result. Sync is limited to once per 10 minutes per
 * journey fingerprint.
 */
export function useFlightStatus(
  requests: (FlightStatusRequest | undefined)[],
): FlightStatusLookup {
  const requestKey = useMemo(
    () => flightStatusSyncRequestKey(requests),
    [requests],
  );
  const [state, setState] = useState<{
    loading: boolean;
    checked: boolean;
    legs: (FlightLegStatus | undefined)[];
    error?: string;
  }>(() => {
    const cached = requestKey ? lastLegsByKey.get(requestKey) : undefined;
    return {
      loading: false,
      checked: Boolean(cached),
      legs: cached ? [...cached] : [],
    };
  });
  const [cooldownRemainingMs, setCooldownRemainingMs] = useState(() =>
    flightStatusSyncCooldownRemainingMs(requestKey),
  );
  const available = requests.some(Boolean);
  const canCheck = available && !state.loading && cooldownRemainingMs <= 0;
  const cooldownMinutesRemaining =
    flightStatusSyncCooldownMinutesRemaining(cooldownRemainingMs);

  useEffect(() => {
    const remaining = flightStatusSyncCooldownRemainingMs(requestKey);
    setCooldownRemainingMs(remaining);
    const cached = requestKey ? lastLegsByKey.get(requestKey) : undefined;
    if (cached) {
      setState((current) =>
        current.loading
          ? current
          : { ...current, checked: true, legs: [...cached] },
      );
    }
  }, [requestKey]);

  useEffect(() => {
    if (cooldownRemainingMs <= 0) return;
    const timer = setTimeout(() => {
      setCooldownRemainingMs(0);
    }, cooldownRemainingMs);
    return () => clearTimeout(timer);
  }, [cooldownRemainingMs]);

  const activeRequestKeyRef = useRef(requestKey);
  activeRequestKeyRef.current = requestKey;

  const check = useCallback(() => {
    if (!available || !requestKey) return;
    if (flightStatusSyncCooldownRemainingMs(requestKey) > 0) return;

    const startedForKey = requestKey;
    setState((current) => ({ ...current, loading: true, error: undefined }));
    void (async () => {
      const settled = await Promise.all(
        requests.map(async (request) => {
          if (!request) return undefined;
          try {
            const result = await lookupFlightData({
              ...request.input,
              mode: 'status',
            });
            return {
              label: request.label,
              status: result.status,
              statusLabel:
                flightOperationalStatusLabel(result.status) ??
                result.statusLabel,
              departureTerminal: result.departureTerminal,
              departureGate: result.departureGate,
              arrivalTerminal: result.arrivalTerminal,
              arrivalGate: result.arrivalGate,
            } satisfies FlightLegStatus;
          } catch (error) {
            return {
              label: request.label,
              status: undefined,
              errorMessage:
                error instanceof Error ? error.message : 'Status unavailable.',
            } as FlightLegStatus & { errorMessage?: string };
          }
        }),
      );
      // Journey fingerprint changed while in-flight — drop stale results.
      if (activeRequestKeyRef.current !== startedForKey) return;
      const failure = settled.find(
        (leg): leg is FlightLegStatus & { errorMessage: string } =>
          Boolean(leg && 'errorMessage' in leg && leg.errorMessage),
      );
      const checkedAt = Date.now();
      lastSyncAtByKey.set(startedForKey, checkedAt);
      lastLegsByKey.set(startedForKey, settled);
      setCooldownRemainingMs(FLIGHT_STATUS_SYNC_COOLDOWN_MS);
      setState({
        loading: false,
        checked: true,
        legs: settled,
        ...(settled.some((leg) => leg?.status)
          ? {}
          : { error: failure?.errorMessage ?? 'Status unavailable right now.' }),
      });
    })();
  }, [available, requestKey, requests]);

  const labels = state.legs.flatMap((leg) =>
    leg?.statusLabel
      ? [leg.label ? `${leg.label}: ${leg.statusLabel}` : leg.statusLabel]
      : [],
  );

  return {
    available,
    loading: state.loading,
    checked: state.checked,
    canCheck,
    cooldownMinutesRemaining,
    legs: state.legs,
    ...(labels.length ? { summary: labels.join(' · ') } : {}),
    ...(state.error ? { error: state.error } : {}),
    status: mostUrgent(state.legs),
    check,
  };
}
