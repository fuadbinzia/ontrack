import { useCallback, useEffect, useState } from 'react';

import {
  getCurrentPlaceLabel,
  type DevicePlaceResult,
} from '@/utils/device-location';

export type CurrentPlaceStatus =
  | 'idle'
  | 'loading'
  | DevicePlaceResult['status'];

export type CurrentPlaceLabelState = {
  status: CurrentPlaceStatus;
  label: string;
  /** Human detail for settings rows. */
  detail: string;
  refresh: () => void;
};

/** Settings-row detail copy for a device place status. */
export function detailForCurrentPlace(
  status: CurrentPlaceStatus,
  label: string,
): string {
  switch (status) {
    case 'suggested':
      return label;
    case 'loading':
      return 'Locating…';
    case 'denied':
      return 'Location permission off';
    case 'unavailable':
      return 'Unavailable';
    case 'idle':
    default:
      return '—';
  }
}

/**
 * Live device place via location services. Never writes preferences —
 * home location stays user-authored only.
 */
export function useCurrentPlaceLabel(enabled = true): CurrentPlaceLabelState {
  const [status, setStatus] = useState<CurrentPlaceStatus>(enabled ? 'loading' : 'idle');
  const [label, setLabel] = useState('');
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => {
    setTick((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setStatus('idle');
      setLabel('');
      return;
    }

    let cancelled = false;
    setStatus('loading');
    void getCurrentPlaceLabel().then((result) => {
      if (cancelled) return;
      if (result.status === 'suggested') {
        setLabel(result.label);
        setStatus('suggested');
        return;
      }
      setLabel('');
      setStatus(result.status);
    });

    return () => {
      cancelled = true;
    };
  }, [enabled, tick]);

  return {
    status,
    label,
    detail: detailForCurrentPlace(status, label),
    refresh,
  };
}
