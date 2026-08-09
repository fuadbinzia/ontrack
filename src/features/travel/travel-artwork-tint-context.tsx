import {
  createContext,
  useContext,
  useMemo,
  type PropsWithChildren,
} from 'react';

import {
  travelArtworkTintPrefersLightInk,
} from '@/features/travel/travel-artwork-tint';

export type TravelArtworkTintValue = {
  /** Prominent artwork hex (`#RRGGBB`) for glass fills — undefined = default frost. */
  hex?: string;
  /** Dark tinted glass → light ink even in light theme. */
  darkGlass: boolean;
};

const DEFAULT: TravelArtworkTintValue = { darkGlass: false };

const TravelArtworkTintContext =
  createContext<TravelArtworkTintValue>(DEFAULT);

/** Plan-detail provider — header plate color drives itinerary glass tint. */
export function TravelArtworkTintProvider({
  hex,
  children,
}: PropsWithChildren<{ hex?: string }>) {
  const value = useMemo<TravelArtworkTintValue>(() => {
    const next = hex?.trim();
    if (!next) return DEFAULT;
    return {
      hex: next,
      darkGlass: travelArtworkTintPrefersLightInk(next),
    };
  }, [hex]);

  return (
    <TravelArtworkTintContext.Provider value={value}>
      {children}
    </TravelArtworkTintContext.Provider>
  );
}

export function useTravelArtworkTint(): TravelArtworkTintValue {
  return useContext(TravelArtworkTintContext);
}
